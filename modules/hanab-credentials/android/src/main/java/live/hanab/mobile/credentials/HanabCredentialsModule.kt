package live.hanab.mobile.credentials

import android.content.Context
import androidx.credentials.CreatePasswordRequest
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetPasswordOption
import androidx.credentials.PasswordCredential
import androidx.credentials.exceptions.CreateCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.NoCredentialException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.GetCredentialProviderConfigurationException
import androidx.credentials.exceptions.CreateCredentialException
import androidx.credentials.exceptions.CreateCredentialProviderConfigurationException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray

class HanabCredentialsModule : Module() {
  private val preferences by lazy {
    appContext.reactContext!!.getSharedPreferences("hanab_recent_accounts", Context.MODE_PRIVATE)
  }

  override fun definition() = ModuleDefinition {
    Name("HanabCredentials")

    AsyncFunction("listRecentAccounts") {
      recentAccounts()
    }

    AsyncFunction("rememberAccount") { username: String ->
      val clean = username.trim()
      if (clean.isNotEmpty()) {
        val updated = (listOf(clean) + recentAccounts().filterNot { it == clean })
        saveRecentAccounts(updated)
      }
      recentAccounts()
    }

    AsyncFunction("forgetAccount") { username: String ->
      val updated = recentAccounts().filterNot { it == username }
      saveRecentAccounts(updated)
      updated
    }

    AsyncFunction("getPasswordCredential") Coroutine { username: String ->
      val activity = appContext.activityProvider?.currentActivity
        ?: return@Coroutine mapOf("kind" to "unavailable")
      try {
        val option = GetPasswordOption(allowedUserIds = setOf(username), isAutoSelectAllowed = true)
        val response = CredentialManager.create(activity).getCredential(
          activity,
          GetCredentialRequest(listOf(option))
        )
        val credential = response.credential
        if (credential is PasswordCredential) {
          mapOf("kind" to "credential", "username" to credential.id, "password" to credential.password)
        } else {
          mapOf("kind" to "none")
        }
      } catch (_: GetCredentialCancellationException) {
        mapOf("kind" to "cancelled")
      } catch (_: NoCredentialException) {
        mapOf("kind" to "none")
      } catch (_: GetCredentialProviderConfigurationException) {
        mapOf("kind" to "unavailable")
      } catch (_: GetCredentialException) {
        mapOf("kind" to "error")
      } catch (_: Exception) {
        mapOf("kind" to "error")
      }
    }

    AsyncFunction("savePasswordCredential") Coroutine { username: String, password: String ->
      val activity = appContext.activityProvider?.currentActivity
        ?: return@Coroutine mapOf("kind" to "unavailable")
      try {
        CredentialManager.create(activity).createCredential(
          activity,
          CreatePasswordRequest(username, password)
        )
        mapOf("kind" to "saved")
      } catch (_: CreateCredentialCancellationException) {
        mapOf("kind" to "cancelled")
      } catch (_: CreateCredentialProviderConfigurationException) {
        mapOf("kind" to "unavailable")
      } catch (_: CreateCredentialException) {
        mapOf("kind" to "error")
      } catch (_: Exception) {
        mapOf("kind" to "error")
      }
    }
  }

  private fun recentAccounts(): List<String> = try {
    val stored = preferences.getString(KEY_USERNAMES, null) ?: return emptyList()
    val json = JSONArray(stored)
    (0 until json.length()).mapNotNull { index -> json.optString(index).takeIf { it.isNotBlank() } }
  } catch (_: Exception) {
    emptyList()
  }

  private fun saveRecentAccounts(accounts: List<String>) {
    preferences.edit().putString(KEY_USERNAMES, JSONArray(accounts).toString()).apply()
  }

  private companion object {
    const val KEY_USERNAMES = "recent_usernames"
  }
}
