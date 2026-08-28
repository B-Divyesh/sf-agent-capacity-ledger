use std::{env, net::SocketAddr, path::PathBuf, sync::Arc};

use axum::{
    extract::{Path, State},
    http::{header, HeaderValue, StatusCode},
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
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
    db: SqlitePool,
    build_sha: String,
}

#[derive(Serialize)]
struct Health {
    status: &'static str,
    build_sha: String,
}

#[derive(Deserialize)]
struct LedgerPayload {
    data: Value,
}

#[derive(Serialize)]
struct LedgerResponse {
    data: Value,
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
    let row: Option<(String, String)> =
        sqlx::query_as("SELECT data, updated_at FROM ledgers WHERE workspace_id = ?")
            .bind(workspace)
            .fetch_optional(&state.db)
            .await
            .map_err(internal)?;

    match row {
        Some((data, updated_at)) => {
            let data = serde_json::from_str(&data).map_err(internal)?;
            Ok(Json(LedgerResponse { data, updated_at }))
        }
        None => Err(error(
            StatusCode::NOT_FOUND,
            "No ledger exists in this workspace yet.",
        )),
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
    let encoded = serde_json::to_string(&payload.data).map_err(internal)?;
    if encoded.len() > 1_000_000 {
        return Err(error(
            StatusCode::PAYLOAD_TOO_LARGE,
            "The ledger is over the 1 MB limit.",
        ));
    }
    let updated_at = chrono::Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO ledgers (workspace_id, data, updated_at) VALUES (?, ?, ?)\
         ON CONFLICT(workspace_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at",
    )
    .bind(workspace)
    .bind(&encoded)
    .bind(&updated_at)
    .execute(&state.db)
    .await
    .map_err(internal)?;

    Ok(Json(LedgerResponse {
        data: payload.data,
        updated_at,
    }))
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

async fn make_app(database_url: &str, build_sha: String, dist: PathBuf) -> Router {
    let db = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(database_url)
        .await
        .expect("database should open");
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS ledgers (\
         workspace_id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)",
    )
    .execute(&db)
    .await
    .expect("database should migrate");

    let state = AppState { db, build_sha };
    let governor = Arc::new(
        GovernorConfigBuilder::default()
            .per_millisecond(50)
            .burst_size(40)
            .key_extractor(SmartIpKeyExtractor)
            .use_headers()
            .finish()
            .expect("rate limiter config"),
    );

    let api = Router::new()
        .route("/ledger/{workspace}", get(get_ledger).put(put_ledger))
        .layer(GovernorLayer::new(governor));

    Router::new()
        .route("/health", get(health))
        .nest("/api", api)
        .fallback_service(ServeDir::new(&dist).not_found_service(ServeFile::new(dist.join("index.html"))))
        .with_state(state)
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
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let port: u16 = env::var("PORT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(8080);
    let build_sha = env::var("BUILD_SHA").unwrap_or_else(|_| "dev".into());
    let data_dir = env::var("DATA_DIR").unwrap_or_else(|_| "/data".into());
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
    let database_url = format!("sqlite://{}/ledger.db?mode=rwc", usable_dir.display());
    info!(port, database = %usable_dir.display(), build_sha = %build_sha, "config supplied: PORT; generated/defaulted: database path and build identity when absent");

    let app = make_app(&database_url, build_sha, PathBuf::from("dist")).await;
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
        make_app("sqlite::memory:", "test-sha".into(), PathBuf::from("dist")).await
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
            .body(Body::from(r#"{"data":{"sources":[{"name":"Cursor"}]}}"#))
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
}
