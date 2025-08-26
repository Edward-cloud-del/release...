use chrono;
use reqwest;
use serde::{Deserialize, Serialize};
//use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
//use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct User {
  pub id: String,
  pub email: String,
  pub name: String,
  pub tier: String, // "free", "premium", "pro", "enterprise"
  pub token: String,
  pub usage: UserUsage,
  pub created_at: String,
  pub subscription_status: Option<String>,
  pub stripe_customer_id: Option<String>,
  pub usage_daily: Option<i32>,
  pub usage_total: Option<i32>,
  pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserUsage {
  pub daily: i32,
  pub total: i32,
  pub last_reset: String,
}

// Add the missing Usage struct that main.rs references
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Usage {
  pub daily: i32,
  pub total: i32,
  pub last_reset: String,
}

impl Default for UserUsage {
  fn default() -> Self {
    Self {
      daily: 0,
      total: 0,
      last_reset: chrono::Utc::now().format("%Y-%m-%d").to_string(),
    }
  }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginRequest {
  pub email: String,
  pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BackendUser {
  pub id: String,
  pub email: String,
  pub name: String,
  pub tier: String,
  pub subscription_status: Option<String>,
  pub stripe_customer_id: Option<String>,
  pub usage_daily: Option<i32>,
  pub usage_total: Option<i32>,
  pub created_at: Option<String>,
  pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthResponse {
  pub success: bool,
  pub user: Option<BackendUser>,
  pub token: Option<String>,
  pub message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
  pub user_id: String,
  pub email: String,
  pub exp: usize,
}

#[derive(Clone)]
pub struct AuthService {
  api_url: String,
  storage_path: Option<PathBuf>,
}

impl AuthService {
  pub fn new() -> Self {
    Self {
      api_url: "https://api.finalyze.pro".to_string(), // Railway backend URL
      storage_path: None,
    }
  }

  pub fn with_storage_path(mut self, path: PathBuf) -> Self {
    self.storage_path = Some(path);
    self
  }

  pub async fn login_user(&self, email: String, password: String) -> Result<User, String> {
    let client = reqwest::Client::new();

    let login_data = LoginRequest { email, password };

    let response = client
      .post(&format!("{}/api/auth/login", self.api_url))
      .json(&login_data)
      .send()
      .await
      .map_err(|e| format!("Network error: {}", e))?;

    if response.status().is_success() {
      let auth_response: AuthResponse = response
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

      if auth_response.success {
        if let (Some(backend_user), Some(token)) = (auth_response.user, auth_response.token) {
          // Convert backend user format to frontend User format
          let user = User {
            id: backend_user.id,
            email: backend_user.email,
            name: backend_user.name,
            tier: backend_user.tier,
            token: token.clone(),
            usage: UserUsage {
              daily: backend_user.usage_daily.unwrap_or(0),
              total: backend_user.usage_total.unwrap_or(0),
              last_reset: chrono::Utc::now().format("%Y-%m-%d").to_string(),
            },
            created_at: backend_user
              .created_at
              .unwrap_or_else(|| chrono::Utc::now().to_rfc3339()),
            subscription_status: backend_user.subscription_status,
            stripe_customer_id: backend_user.stripe_customer_id,
            usage_daily: backend_user.usage_daily,
            usage_total: backend_user.usage_total,
            updated_at: backend_user.updated_at,
          };

          // Save user session locally
          self.save_user_session(&user).await?;

          println!(
            "✅ User logged in successfully: {} ({})",
            user.email, user.tier
          );
          Ok(user)
        } else {
          Err("Invalid response format".to_string())
        }
      } else {
        Err(auth_response.message.unwrap_or("Login failed".to_string()))
      }
    } else {
      Err("Authentication failed".to_string())
    }
  }

  // Manual payment verification - loads fresh user data from backend
  pub async fn verify_payment_and_update(&self) -> Result<Option<User>, String> {
    // First check if we have a current session
    if let Some(current_user) = self.load_user_session().await? {
      // Verify current token with backend to get latest user data
      let updated_user = self.verify_token(current_user.token).await?;
      //HÄRRR!!
      // If tier changed, save updated session
      if updated_user.tier != current_user.tier {
        println!(
          "🔄 User tier updated from {} to {}",
          current_user.tier, updated_user.tier
        );
        self.save_user_session(&updated_user).await?;
      }

      Ok(Some(updated_user))
    } else {
      // No current session
      Ok(None)
    }
  }

  pub async fn verify_token(&self, token: String) -> Result<User, String> {
    let client = reqwest::Client::new();
    //Härr
    let response = client
      .get(&format!("{}/api/auth/verify", self.api_url))
      .header("Authorization", format!("Bearer {}", token))
      .send()
      .await
      .map_err(|e| format!("Verification error: {}", e))?;

    if response.status().is_success() {
      let auth_response: AuthResponse = response
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

      if auth_response.success {
        if let Some(backend_user) = auth_response.user {
          // Convert backend user format to frontend User format
          let user = User {
            id: backend_user.id,
            email: backend_user.email,
            name: backend_user.name,
            tier: backend_user.tier,
            token: token.clone(),
            usage: UserUsage {
              daily: backend_user.usage_daily.unwrap_or(0),
              total: backend_user.usage_total.unwrap_or(0),
              last_reset: chrono::Utc::now().format("%Y-%m-%d").to_string(),
            },
            created_at: backend_user
              .created_at
              .unwrap_or_else(|| chrono::Utc::now().to_rfc3339()),
            subscription_status: backend_user.subscription_status,
            stripe_customer_id: backend_user.stripe_customer_id,
            usage_daily: backend_user.usage_daily,
            usage_total: backend_user.usage_total,
            updated_at: backend_user.updated_at,
          };
          Ok(user)
        } else {
          Err("Invalid response format".to_string())
        }
      } else {
        Err("Token verification failed".to_string())
      }
    } else {
      Err("Authentication failed".to_string())
    }
  }

  pub async fn logout_user(&self) -> Result<(), String> {
    self.clear_user_session().await
  }

  pub async fn get_current_user(&self) -> Result<Option<User>, String> {
    self.load_user_session().await
  }

  pub fn get_available_models(&self, user_tier: &str) -> Vec<&'static str> {
    match user_tier {
      "free" => vec!["GPT-3.5-turbo", "Gemini Flash"],
      "premium" => vec![
        "GPT-3.5-turbo",
        "Gemini Flash",
        "GPT-4o-mini",
        "Claude 3 Haiku",
        "Gemini Pro",
        "Jamba Mini",
        "Mistral Small",
      ],
      "pro" => vec![
        "GPT-3.5-turbo",
        "Gemini Flash",
        "GPT-4o-mini",
        "Claude 3 Haiku",
        "Gemini Pro",
        "Jamba Mini",
        "Mistral Small",
        "GPT-4o",
        "Claude 3.5 Sonnet",
        "Jamba Large",
        "Mistral Medium",
      ],
      "enterprise" => vec![
        "GPT-3.5-turbo",
        "Gemini Flash",
        "GPT-4o-mini",
        "Claude 3 Haiku",
        "Gemini Pro",
        "Jamba Mini",
        "Mistral Small",
        "GPT-4o",
        "Claude 3.5 Sonnet",
        "Jamba Large",
        "Mistral Medium",
        "GPT-4o 32k",
        "Claude 3 Opus",
        "Mistral Large",
      ],
      _ => vec!["GPT-3.5-turbo"], // Fallback
    }
  }

  pub fn can_use_model(&self, user_tier: &str, model: &str) -> bool {
    self.get_available_models(user_tier).contains(&model)
  }

  pub async fn save_user_session(&self, user: &User) -> Result<(), String> {
    println!(
      "🔍 DEBUG: save_user_session called for user: {} ({})",
      user.email, user.tier
    );

    if let Some(storage_path) = &self.storage_path {
      let user_file = storage_path.join("user_session.json");
      println!("🔍 DEBUG: Storage path: {:?}", user_file);

      // Ensure directory exists
      if let Some(parent) = user_file.parent() {
        if !parent.exists() {
          println!("🔍 DEBUG: Creating storage directory: {:?}", parent);
          fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create storage directory: {}", e))?;
          println!("✅ DEBUG: Storage directory created");
        } else {
          println!("🔍 DEBUG: Storage directory already exists");
        }
      }

      let user_json = serde_json::to_string_pretty(user)
        .map_err(|e| format!("Failed to serialize user: {}", e))?;

      println!("🔍 DEBUG: About to write {} bytes to file", user_json.len());
      fs::write(&user_file, &user_json)
        .map_err(|e| format!("Failed to write user session: {}", e))?;

      println!(
        "✅ DEBUG: User session saved to Tauri storage at: {:?}",
        user_file
      );
    } else {
      println!("❌ DEBUG: No storage path configured!");
      return Err("No storage path configured".to_string());
    }
    Ok(())
  }

  pub async fn clear_user_session(&self) -> Result<(), String> {
    println!("🔍 DEBUG: clear_user_session called");

    if let Some(storage_path) = &self.storage_path {
      let user_file = storage_path.join("user_session.json");
      println!(
        "🔍 DEBUG: Looking for session file to delete at: {:?}",
        user_file
      );

      if user_file.exists() {
        println!("🔍 DEBUG: Session file exists, deleting...");
        fs::remove_file(&user_file).map_err(|e| format!("Failed to remove user session: {}", e))?;
        println!("✅ DEBUG: User session file deleted successfully");
      } else {
        println!("ℹ️ DEBUG: No session file to delete (already cleared)");
      }
    } else {
      println!("❌ DEBUG: No storage path configured for clearing!");
    }
    Ok(())
  }

  pub async fn load_user_session(&self) -> Result<Option<User>, String> {
    println!("🔍 DEBUG: load_user_session called");

    if let Some(storage_path) = &self.storage_path {
      let user_file = storage_path.join("user_session.json");
      println!("🔍 DEBUG: Looking for session file at: {:?}", user_file);

      if user_file.exists() {
        println!("✅ DEBUG: Session file exists, reading...");
        let user_json = fs::read_to_string(&user_file)
          .map_err(|e| format!("Failed to read user session: {}", e))?;

        println!("🔍 DEBUG: Read {} bytes from session file", user_json.len());

        let user: User = serde_json::from_str(&user_json)
          .map_err(|e| format!("Failed to parse user session: {}", e))?;

        println!(
          "✅ DEBUG: User session loaded successfully: {} ({})",
          user.email, user.tier
        );
        return Ok(Some(user));
      } else {
        println!("❌ DEBUG: Session file does not exist at: {:?}", user_file);
      }
    } else {
      println!("❌ DEBUG: No storage path configured for loading!");
    }
    println!("❌ DEBUG: Returning None from load_user_session");
    Ok(None)
  }
}

impl Default for AuthService {
  fn default() -> Self {
    Self::new()
  }
}
