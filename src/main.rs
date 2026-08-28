use std::{collections::HashSet, env, net::SocketAddr, path::PathBuf, sync::Arc};

use axum::{
    extract::{Path, Request, State},
    http::{header, HeaderValue, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response as AxumResponse},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{postgres::PgPoolOptions, sqlite::SqlitePoolOptions, PgPool, SqlitePool};
use tower_governor::{
    governor::GovernorConfigBuilder, key_extractor::SmartIpKeyExtractor, GovernorLayer,
};
use tower_http::{
    services::{ServeDir, ServeFile},
    set_header::SetResponseHeaderLayer,
    trace::TraceLayer,
};
use tracing::info;

#[derive(Clone)]
struct AppState {
    db: Database,
    build_sha: String,
}

#[derive(Clone)]
enum Database {
    Sqlite(SqlitePool),
    Postgres(PgPool),
}

#[derive(Serialize)]
struct Health {
    status: &'static str,
    build_sha: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SourceData {
    id: String,
    vendor: String,
    plan: String,
    limit: f64,
    used: f64,
    daily_pace: f64,
    resets_on: String,
    monthly_cost: f64,
    fallback_id: String,
    notes: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SpendData {
    id: String,
    date: String,
    project: String,
    source_id: String,
    amount: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LedgerData {
    team_name: String,
    sources: Vec<SourceData>,
    spend: Vec<SpendData>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct LedgerPayload {
    data: LedgerData,
}

#[derive(Serialize)]
struct LedgerResponse {
    data: LedgerData,
    updated_at: String,
}

fn valid_workspace(id: &str) -> bool {
    (8..=64).contains(&id.len())
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

async fn health(State(state): State<AppState>) -> impl IntoResponse {
    Json(Health {
        status: "ok",
        build_sha: state.build_sha,
    })
}

async fn get_ledger(
    State(state): State<AppState>,
    Path(workspace): Path<String>,
) -> Result<Json<LedgerResponse>, (StatusCode, Json<Value>)> {
    if !valid_workspace(&workspace) {
        return Err(error(StatusCode::BAD_REQUEST, "Workspace ID is not valid."));
    }
    let row: Option<(String, String)> = match &state.db {
        Database::Sqlite(db) => sqlx::query_as(
            "SELECT data, updated_at FROM agent_capacity_ledgers WHERE workspace_id = ?",
        )
        .bind(workspace)
        .fetch_optional(db)
        .await
        .map_err(internal)?,
        Database::Postgres(db) => sqlx::query_as(
            "SELECT data, updated_at FROM agent_capacity_ledgers WHERE workspace_id = $1",
        )
        .bind(workspace)
        .fetch_optional(db)
        .await
        .map_err(internal)?,
    };

    match row {
        Some((data, updated_at)) => {
            let data = serde_json::from_str(&data).map_err(internal)?;
            Ok(Json(LedgerResponse { data, updated_at }))
        }
        None => Ok(Json(LedgerResponse {
            data: empty_ledger(),
            updated_at: String::new(),
        })),
    }
}

async fn put_ledger(
    State(state): State<AppState>,
    Path(workspace): Path<String>,
    Json(payload): Json<LedgerPayload>,
) -> Result<Json<LedgerResponse>, (StatusCode, Json<Value>)> {
    if !valid_workspace(&workspace) {
        return Err(error(StatusCode::BAD_REQUEST, "Workspace ID is not valid."));
    }
    validate_ledger(&payload.data)?;
    let encoded = serde_json::to_string(&payload.data).map_err(internal)?;
    if encoded.len() > 1_000_000 {
        return Err(error(
            StatusCode::PAYLOAD_TOO_LARGE,
            "The ledger is over the 1 MB limit.",
        ));
    }
    let updated_at = chrono::Utc::now().to_rfc3339();
    match &state.db {
        Database::Sqlite(db) => {
            sqlx::query(
            "INSERT INTO agent_capacity_ledgers (workspace_id, data, updated_at) VALUES (?, ?, ?)\
             ON CONFLICT(workspace_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at",
        )
        .bind(workspace)
        .bind(&encoded)
        .bind(&updated_at)
        .execute(db)
        .await
        .map_err(internal)?;
        }
        Database::Postgres(db) => {
            sqlx::query(
            "INSERT INTO agent_capacity_ledgers (workspace_id, data, updated_at) VALUES ($1, $2, $3)\
             ON CONFLICT(workspace_id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at",
        )
        .bind(workspace)
        .bind(&encoded)
        .bind(&updated_at)
        .execute(db)
        .await
        .map_err(internal)?;
        }
    };

    Ok(Json(LedgerResponse {
        data: payload.data,
        updated_at,
    }))
}

fn empty_ledger() -> LedgerData {
    LedgerData {
        team_name: "My engineering team".into(),
        sources: Vec::new(),
        spend: Vec::new(),
    }
}

fn valid_text(value: &str, max: usize) -> bool {
    !value.trim().is_empty() && value.chars().count() <= max
}

fn valid_date(value: &str) -> bool {
    chrono::NaiveDate::parse_from_str(value, "%Y-%m-%d").is_ok()
}

fn validate_ledger(data: &LedgerData) -> Result<(), (StatusCode, Json<Value>)> {
    if !valid_text(&data.team_name, 120) || data.sources.len() > 1_000 || data.spend.len() > 10_000
    {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "The ledger has invalid team or record values.",
        ));
    }
    let source_ids: HashSet<&str> = data
        .sources
        .iter()
        .map(|source| source.id.as_str())
        .collect();
    if source_ids.len() != data.sources.len() {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "Each source needs a unique ID.",
        ));
    }
    for source in &data.sources {
        if !valid_text(&source.id, 128)
            || !valid_text(&source.vendor, 120)
            || !valid_text(&source.plan, 120)
            || !source.limit.is_finite()
            || source.limit <= 0.0
            || !source.used.is_finite()
            || source.used < 0.0
            || source.used > source.limit
            || !source.daily_pace.is_finite()
            || source.daily_pace < 0.0
            || !source.monthly_cost.is_finite()
            || source.monthly_cost < 0.0
            || !valid_date(&source.resets_on)
            || source.notes.chars().count() > 2_000
            || (!source.fallback_id.is_empty()
                && (source.fallback_id == source.id
                    || !source_ids.contains(source.fallback_id.as_str())))
        {
            return Err(error(
                StatusCode::BAD_REQUEST,
                "A source has invalid limits, use, reset date, cost, or fallback.",
            ));
        }
    }
    let spend_ids: HashSet<&str> = data.spend.iter().map(|entry| entry.id.as_str()).collect();
    if spend_ids.len() != data.spend.len() {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "Each spend entry needs a unique ID.",
        ));
    }
    for entry in &data.spend {
        if !valid_text(&entry.id, 128)
            || !valid_text(&entry.project, 200)
            || !valid_date(&entry.date)
            || !source_ids.contains(entry.source_id.as_str())
            || !entry.amount.is_finite()
            || entry.amount < 0.0
        {
            return Err(error(
                StatusCode::BAD_REQUEST,
                "A project spend entry has invalid values.",
            ));
        }
    }
    Ok(())
}

async fn cache_assets(request: Request, next: Next) -> AxumResponse {
    let immutable = request.uri().path().starts_with("/assets/");
    let mut response = next.run(request).await;
    if immutable {
        response.headers_mut().insert(
            header::CACHE_CONTROL,
            HeaderValue::from_static("public, max-age=31536000, immutable"),
        );
    }
    response
}

fn error(status: StatusCode, message: &str) -> (StatusCode, Json<Value>) {
    (status, Json(serde_json::json!({ "error": message })))
}

fn internal<E: std::fmt::Display>(err: E) -> (StatusCode, Json<Value>) {
    tracing::error!(error = %err, "request failed");
    error(
        StatusCode::INTERNAL_SERVER_ERROR,
        "The ledger could not be saved. Try again.",
    )
}

async fn make_app(database_url: &str, build_sha: String, dist: PathBuf, migrate: bool) -> Router {
    let schema = "CREATE TABLE IF NOT EXISTS agent_capacity_ledgers (\
         workspace_id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)";
    let db = if database_url.starts_with("postgres://") || database_url.starts_with("postgresql://")
    {
        let pool = PgPoolOptions::new()
            .max_connections(10)
            .connect(database_url)
            .await
            .expect("shared PostgreSQL database should open");
        if migrate {
            sqlx::query(schema)
                .execute(&pool)
                .await
                .expect("database should migrate");
        }
        Database::Postgres(pool)
    } else {
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(database_url)
            .await
            .expect("SQLite database should open");
        if migrate {
            sqlx::query(schema)
                .execute(&pool)
                .await
                .expect("database should migrate");
        }
        Database::Sqlite(pool)
    };
    let state = AppState { db, build_sha };
    let governor = Arc::new(
        GovernorConfigBuilder::default()
            .per_millisecond(200)
            .burst_size(10)
            .key_extractor(SmartIpKeyExtractor)
            .use_headers()
            .finish()
            .expect("rate limiter config"),
    );

    let api = Router::new()
        .route("/ledger/{workspace}", get(get_ledger).put(put_ledger))
        .fallback(|| async { StatusCode::NOT_FOUND })
        .layer(GovernorLayer::new(governor));

    let index = ServeFile::new(dist.join("index.html"));
    let files = ServeDir::new(&dist).not_found_service(ServeFile::new(dist.join("404.html")));

    Router::new()
        .route("/health", get(health))
        .nest("/api", api)
        .route_service("/", index.clone())
        .route_service("/demo", index.clone())
        .route_service("/ledger", index.clone())
        .route_service("/privacy", index.clone())
        .route_service("/terms", index)
        .fallback_service(files)
        .with_state(state)
        .layer(middleware::from_fn(cache_assets))
        .layer(SetResponseHeaderLayer::overriding(
            header::X_CONTENT_TYPE_OPTIONS,
            HeaderValue::from_static("nosniff"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            header::REFERRER_POLICY,
            HeaderValue::from_static("strict-origin-when-cross-origin"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            header::CONTENT_SECURITY_POLICY,
            HeaderValue::from_static("default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self' https://api.sociobot.in; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            header::HeaderName::from_static("permissions-policy"),
            HeaderValue::from_static("camera=(), microphone=(), geolocation=()"),
        ))
        .layer(TraceLayer::new_for_http())
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .json()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let port_value = env::var("PORT").ok();
    let port: u16 = port_value
        .as_deref()
        .and_then(|v| v.parse().ok())
        .unwrap_or(8080);
    let build_sha_value = env::var("BUILD_SHA").ok();
    let build_sha = build_sha_value.clone().unwrap_or_else(|| "dev".into());
    let database_url_value = env::var("DATABASE_URL").ok();
    let data_dir_value = env::var("DATA_DIR").ok();
    let data_dir = data_dir_value.clone().unwrap_or_else(|| "/data".into());
    let data_path = PathBuf::from(&data_dir);
    if tokio::fs::create_dir_all(&data_path).await.is_err() {
        tracing::warn!(path = %data_path.display(), "data directory unavailable; using local data directory");
    }
    let usable_dir = if data_path.exists() {
        data_path
    } else {
        PathBuf::from("data")
    };
    tokio::fs::create_dir_all(&usable_dir)
        .await
        .expect("create data directory");
    let database_url = database_url_value
        .clone()
        .unwrap_or_else(|| format!("sqlite://{}/ledger.db?mode=rwc", usable_dir.display()));
    info!(
        port,
        port_source = if port_value.is_some() { "supplied" } else { "defaulted" },
        database_kind = if database_url_value.is_some() { "supplied-shared" } else { "defaulted-local" },
        data_dir_source = if data_dir_value.is_some() { "supplied" } else { "defaulted" },
        build_sha = %build_sha,
        build_sha_source = if build_sha_value.is_some() { "supplied" } else { "defaulted" },
        "runtime configuration"
    );

    let database_migrate = env::var("DATABASE_MIGRATE").is_ok_and(|value| value == "1");
    let app = make_app(
        &database_url,
        build_sha,
        PathBuf::from("dist"),
        database_url_value.is_none() || database_migrate,
    )
    .await;
    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port))
        .await
        .expect("bind server");
    info!(address = %SocketAddr::from(([0, 0, 0, 0], port)), "server ready");
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await
    .expect("serve app");
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("install Ctrl+C handler")
    };
    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("install signal handler")
            .recv()
            .await;
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! { _ = ctrl_c => {}, _ = terminate => {} }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, http::Request};
    use http_body_util::BodyExt;
    use tower::ServiceExt;

    async fn app() -> Router {
        make_app(
            "sqlite::memory:",
            "test-sha".into(),
            PathBuf::from("dist"),
            true,
        )
        .await
    }

    fn ledger_json() -> &'static str {
        r#"{"data":{"teamName":"Test team","sources":[{"id":"source-1","vendor":"Cursor","plan":"Team","limit":100,"used":20,"dailyPace":5,"resetsOn":"2099-01-01","monthlyCost":40,"fallbackId":"","notes":""}],"spend":[]}}"#
    }

    #[tokio::test]
    async fn health_reports_build() {
        let response = app()
            .await
            .oneshot(Request::get("/health").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let body = response.into_body().collect().await.unwrap().to_bytes();
        assert!(String::from_utf8_lossy(&body).contains("test-sha"));
    }

    #[tokio::test]
    async fn ledger_round_trip_and_validation() {
        let app = app().await;
        let put = Request::put("/api/ledger/workspace-123")
            .header("x-forwarded-for", "203.0.113.8")
            .header("content-type", "application/json")
            .body(Body::from(ledger_json()))
            .unwrap();
        assert_eq!(
            app.clone().oneshot(put).await.unwrap().status(),
            StatusCode::OK
        );
        let get = Request::get("/api/ledger/workspace-123")
            .header("x-forwarded-for", "203.0.113.8")
            .body(Body::empty())
            .unwrap();
        let response = app.clone().oneshot(get).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let invalid = Request::get("/api/ledger/!")
            .header("x-forwarded-for", "203.0.113.8")
            .body(Body::empty())
            .unwrap();
        assert_eq!(
            app.oneshot(invalid).await.unwrap().status(),
            StatusCode::BAD_REQUEST
        );
    }

    #[tokio::test]
    async fn rejects_invalid_capacity_and_unknown_sensitive_fields() {
        let app = app().await;
        let invalid_capacity = ledger_json().replace("\"used\":20", "\"used\":120");
        let response = app
            .clone()
            .oneshot(
                Request::put("/api/ledger/invalid-capacity")
                    .header("x-forwarded-for", "203.0.113.9")
                    .header("content-type", "application/json")
                    .body(Body::from(invalid_capacity))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let sensitive = ledger_json().replace("\"spend\":[]", "\"prompt\":\"secret\",\"spend\":[]");
        let response = app
            .oneshot(
                Request::put("/api/ledger/unknown-field")
                    .header("x-forwarded-for", "203.0.113.10")
                    .header("content-type", "application/json")
                    .body(Body::from(sensitive))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
    }

    #[tokio::test]
    async fn rate_limit_holds_across_maximum_replica_count() {
        let instances = [app().await, app().await, app().await];
        let mut tasks = tokio::task::JoinSet::new();
        for index in 0..60 {
            let request = Request::get("/api/ledger/shared-rate-test")
                .header("x-forwarded-for", "192.0.2.44")
                .body(Body::empty())
                .unwrap();
            let instance = instances[index % instances.len()].clone();
            tasks.spawn(async move { instance.oneshot(request).await.unwrap() });
        }
        let mut statuses = Vec::new();
        while let Some(response) = tasks.join_next().await {
            let response = response.unwrap();
            let retry_after = response.headers().get(header::RETRY_AFTER).cloned();
            statuses.push((response.status(), retry_after));
        }
        let allowed = statuses
            .iter()
            .filter(|(status, _)| *status == StatusCode::OK)
            .count();
        assert!(
            (30..=33).contains(&allowed),
            "unexpected allowed count: {allowed}"
        );
        assert!(statuses
            .iter()
            .filter(|(status, _)| *status == StatusCode::TOO_MANY_REQUESTS)
            .all(|(_, retry)| retry.is_some()));
    }

    #[tokio::test]
    async fn shared_database_survives_replica_and_restart_reads() {
        let directory = tempfile::tempdir().unwrap();
        let database_url = format!(
            "sqlite://{}?mode=rwc",
            directory.path().join("shared.db").display()
        );
        let first = make_app(&database_url, "first".into(), PathBuf::from("dist"), true).await;
        let write = Request::put("/api/ledger/replica-shared-123")
            .header("x-forwarded-for", "203.0.113.44")
            .header("content-type", "application/json")
            .body(Body::from(ledger_json()))
            .unwrap();
        assert_eq!(first.oneshot(write).await.unwrap().status(), StatusCode::OK);

        for build in ["second", "after-restart"] {
            let replica = make_app(&database_url, build.into(), PathBuf::from("dist"), true).await;
            let response = replica
                .oneshot(
                    Request::get("/api/ledger/replica-shared-123")
                        .header("x-forwarded-for", "203.0.113.45")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();
            let body = response.into_body().collect().await.unwrap().to_bytes();
            assert!(
                String::from_utf8_lossy(&body).contains("Test team"),
                "unexpected replica response: {}",
                String::from_utf8_lossy(&body)
            );
        }
    }

    #[tokio::test]
    async fn unknown_routes_are_404_and_assets_are_immutable() {
        let directory = tempfile::tempdir().unwrap();
        std::fs::create_dir(directory.path().join("assets")).unwrap();
        std::fs::write(directory.path().join("index.html"), "<h1>index</h1>").unwrap();
        std::fs::write(
            directory.path().join("404.html"),
            "<h1>This page has no reading</h1>",
        )
        .unwrap();
        std::fs::write(directory.path().join("assets/test.js"), "export {};").unwrap();
        let app = make_app(
            "sqlite::memory:",
            "test-sha".into(),
            directory.path().into(),
            true,
        )
        .await;
        let response = app
            .clone()
            .oneshot(
                Request::get("/does-not-exist-qa")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::NOT_FOUND);

        let response = app
            .oneshot(Request::get("/assets/test.js").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            response.headers().get(header::CACHE_CONTROL),
            Some(&HeaderValue::from_static(
                "public, max-age=31536000, immutable"
            ))
        );
    }
}
