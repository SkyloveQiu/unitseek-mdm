import asyncio
import logging
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)


class AndroidManagementError(RuntimeError):
    """Base error for Android Management API integration failures."""


class AndroidManagementConfigurationError(AndroidManagementError):
    """Raised when real AMAPI mode is not configured correctly."""


class AndroidManagementService:
    """
    Service for interacting with the Google Android Management API.

    Handles enterprise creation, device management, policy application,
    enrollment token generation, and device commands.

    Mock behavior is available only when ``mode="mock"`` is explicit. In
    ``real`` mode, missing or invalid credentials raise a configuration error
    instead of silently returning data that looks like a successful operation.
    """

    def __init__(
        self,
        credentials_path: str = "",
        project_id: str = "",
        mode: str | None = None,
    ):
        if mode is None:
            from app.config import settings

            mode = settings.AMAPI_MODE
        if mode not in {"mock", "real"}:
            raise ValueError("AMAPI mode must be either 'mock' or 'real'")

        self.credentials_path = credentials_path
        self.project_id = project_id
        self.mode = mode
        self._service = None
        self._initialized = False

    def health(self) -> dict[str, Any]:
        """Return non-sensitive AMAPI configuration status for readiness checks."""
        if self.mode == "mock":
            return {"status": "mock", "mode": "mock"}

        if not self.project_id or not self.credentials_path:
            return {"status": "error", "mode": "real", "reason": "not_configured"}

        if not Path(self.credentials_path).is_file():
            return {"status": "error", "mode": "real", "reason": "credentials_unreadable"}

        try:
            self._get_service()
        except AndroidManagementConfigurationError:
            return {"status": "error", "mode": "real", "reason": "client_init_failed"}

        return {"status": "ok", "mode": "real"}

    def _get_service(self):
        """Lazily initialize the Google API client."""
        if self._initialized:
            return self._service

        if self.mode == "mock":
            self._initialized = True
            return None

        if not self.credentials_path or not self.project_id:
            raise AndroidManagementConfigurationError(
                "GCP_PROJECT_ID and GCP_CREDENTIALS_PATH are required in real mode"
            )
        if not Path(self.credentials_path).is_file():
            raise AndroidManagementConfigurationError(
                "GCP_CREDENTIALS_PATH does not point to a readable file"
            )

        try:
            from google.oauth2 import service_account
            from googleapiclient.discovery import build

            credentials = service_account.Credentials.from_service_account_file(
                self.credentials_path,
                scopes=["https://www.googleapis.com/auth/androidmanagement"],
            )
            self._service = build(
                "androidmanagement", "v1", credentials=credentials
            )
            self._initialized = True
            logger.info("Android Management API client initialized successfully")
            return self._service
        except Exception as e:
            logger.error(
                "Failed to initialize Android Management API client: %s",
                type(e).__name__,
            )
            raise AndroidManagementConfigurationError(
                "Unable to initialize the Android Management API client"
            ) from e

    async def create_signup_url(
        self, callback_url: str
    ) -> Optional[dict[str, Any]]:
        """
        Create a signup URL for enterprise enrollment.
        The admin opens this URL in a browser, signs in with Google,
        and Google redirects back to callback_url with an enterprise token.
        """
        service = self._get_service()

        if service is None:
            logger.warning("create_signup_url: returning mock data (no credentials)")
            return {
                "name": "signupUrls/MOCK-SIGNUP",
                "url": f"{callback_url}?enterpriseToken=MOCK_ENTERPRISE_TOKEN_FOR_DEV",
            }

        try:
            def _call():
                return (
                    service.signupUrls()
                    .create(
                        projectId=self.project_id,
                        callbackUrl=callback_url,
                    )
                    .execute()
                )

            signup_url = await asyncio.to_thread(_call)
            logger.info(f"Signup URL created: {signup_url.get('name')}")
            return signup_url
        except Exception as e:
            logger.error(f"Failed to create signup URL: {e}")
            raise

    async def complete_signup(
        self, enterprise_token: str, contact_email: str, signup_url_name: str = ""
    ) -> Optional[dict[str, Any]]:
        """
        Complete the enterprise signup using the token from Google's redirect.
        Creates the enterprise binding.
        """
        service = self._get_service()

        if service is None:
            logger.warning("complete_signup: returning mock data (no credentials)")
            mock_id = contact_email.split("@")[0]
            return {
                "name": f"enterprises/MOCK-{mock_id}",
                "enabledNotificationTypes": ["ENROLLMENT", "COMPLIANCE_REPORT"],
            }

        try:
            def _call():
                create_kwargs = {
                    "projectId": self.project_id,
                    "enterpriseToken": enterprise_token,
                    "body": {
                        "contactInfo": {
                            "contactEmail": contact_email,
                        },
                    },
                }
                if signup_url_name:
                    create_kwargs["signupUrlName"] = signup_url_name
                return (
                    service.enterprises()
                    .create(**create_kwargs)
                    .execute()
                )

            enterprise = await asyncio.to_thread(_call)
            logger.info(f"Enterprise created via signup: {enterprise.get('name')}")
            return enterprise
        except Exception as e:
            logger.error(f"Failed to complete enterprise signup: {e}")
            raise

    async def create_enterprise(
        self, contact_email: str
    ) -> Optional[dict[str, Any]]:
        """
        Create a new enterprise binding.
        Returns the enterprise resource or mock data.
        """
        service = self._get_service()

        if service is None:
            logger.warning("create_enterprise: returning mock data (no credentials)")
            return {
                "name": f"enterprises/MOCK-{contact_email.split('@')[0]}",
                "enabledNotificationTypes": ["ENROLLMENT", "COMPLIANCE_REPORT"],
                "pubsubTopic": "",
            }

        try:
            def _call():
                return (
                    service.enterprises()
                    .create(
                        projectId=self.project_id,
                        body={
                            "contactEmail": contact_email,
                            "enabledNotificationTypes": [
                                "ENROLLMENT",
                                "COMPLIANCE_REPORT",
                                "STATUS_REPORT",
                                "COMMAND",
                            ],
                        },
                    )
                    .execute()
                )

            enterprise = await asyncio.to_thread(_call)
            logger.info(f"Enterprise created: {enterprise.get('name')}")
            return enterprise
        except Exception as e:
            logger.error(f"Failed to create enterprise: {e}")
            raise

    async def get_enterprise(self, enterprise_name: str) -> Optional[dict[str, Any]]:
        """Read the current Android Enterprise resource and display name."""
        service = self._get_service()

        if service is None:
            logger.warning("get_enterprise: returning mock data for %s", enterprise_name)
            return {
                "name": enterprise_name,
                "enterpriseDisplayName": "Mock Android Enterprise",
            }

        try:
            def _call():
                return service.enterprises().get(name=enterprise_name).execute()

            return await asyncio.to_thread(_call)
        except Exception as e:
            logger.error("Failed to get enterprise %s: %s", enterprise_name, type(e).__name__)
            raise

    async def create_enrollment_token(
        self,
        enterprise_name: str,
        policy_name: str,
        duration: str = "86400s",
        one_time_only: bool = False,
        allow_personal_usage: str | None = None,
    ) -> Optional[dict[str, Any]]:
        """
        Create an enrollment token for device provisioning.
        """
        service = self._get_service()

        if service is None:
            import secrets
            mock_token = secrets.token_urlsafe(32)
            logger.warning("create_enrollment_token: returning mock data")
            return {
                "name": f"{enterprise_name}/enrollmentTokens/MOCK-{mock_token[:16]}",
                "value": mock_token,
                "duration": duration,
                "policyName": policy_name,
                "qrCode": f'{{"android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME":"com.google.android.apps.work.clouddpc/.receivers.CloudDeviceAdminReceiver","android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM":"I5YvS0O5hXY46bJkJRhKEMHmx2v1OlFlMn4Nhiq5vCE=","android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION":"https://play.google.com/managed/downloadManagingApp?identifier=setup","android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE":{{"com.google.android.apps.work.clouddpc.EXTRA_ENROLLMENT_TOKEN":"{mock_token}"}}}}',
            }

        try:
            body = {
                "policyName": policy_name,
                "duration": duration,
                "oneTimeOnly": one_time_only,
            }
            if allow_personal_usage:
                body["allowPersonalUsage"] = allow_personal_usage

            def _call():
                return (
                    service.enterprises()
                    .enrollmentTokens()
                    .create(parent=enterprise_name, body=body)
                    .execute()
                )

            token = await asyncio.to_thread(_call)
            logger.info(f"Enrollment token created: {token.get('name')}")
            return token
        except Exception as e:
            logger.error(f"Failed to create enrollment token: {e}")
            raise

    async def delete_enrollment_token(self, token_name: str) -> bool:
        """Invalidate an AMAPI enrollment token before removing its local record."""
        service = self._get_service()
        if service is None:
            logger.warning("delete_enrollment_token: mock - would delete %s", token_name)
            return True
        try:
            def _call():
                service.enterprises().enrollmentTokens().delete(name=token_name).execute()

            await asyncio.to_thread(_call)
            return True
        except Exception as exc:
            logger.error("Failed to delete enrollment token %s: %s", token_name, type(exc).__name__)
            raise

    async def list_devices(
        self, enterprise_name: str, page_size: int = 100, page_token: str = ""
    ) -> dict[str, Any]:
        """List all devices under an enterprise."""
        service = self._get_service()

        if service is None:
            logger.warning("list_devices: returning mock data")
            return {"devices": [], "nextPageToken": ""}

        try:
            params = {"parent": enterprise_name, "pageSize": page_size}
            if page_token:
                params["pageToken"] = page_token

            def _call():
                return service.enterprises().devices().list(**params).execute()

            result = await asyncio.to_thread(_call)
            return result
        except Exception as e:
            logger.error(f"Failed to list devices: {e}")
            raise

    async def get_device(
        self, device_name: str
    ) -> Optional[dict[str, Any]]:
        """Get a single device by its full resource name."""
        service = self._get_service()

        if service is None:
            logger.warning("get_device: returning mock data")
            return {
                "name": device_name,
                "state": "ACTIVE",
                "appliedState": "ACTIVE",
                "policyCompliant": True,
            }

        try:
            def _call():
                return service.enterprises().devices().get(name=device_name).execute()

            device = await asyncio.to_thread(_call)
            return device
        except Exception as e:
            logger.error(f"Failed to get device {device_name}: {e}")
            raise

    async def apply_policy(
        self, device_name: str, policy_name: str
    ) -> Optional[dict[str, Any]]:
        """Apply a policy to a device."""
        service = self._get_service()

        if service is None:
            logger.warning(
                f"apply_policy: mock - would apply {policy_name} to {device_name}"
            )
            return {"name": device_name, "policyName": policy_name}

        try:
            def _call():
                return (
                    service.enterprises()
                    .devices()
                    .patch(
                        name=device_name,
                        updateMask="policyName",
                        body={"policyName": policy_name},
                    )
                    .execute()
                )

            device = await asyncio.to_thread(_call)
            logger.info(f"Policy {policy_name} applied to {device_name}")
            return device
        except Exception as e:
            logger.error(f"Failed to apply policy: {e}")
            raise

    async def send_command(
        self,
        device_name: str,
        command: str,
        params: Optional[dict[str, Any]] = None,
    ) -> Optional[dict[str, Any]]:
        """
        Send a management command to a device.
        Supported commands: LOCK, REBOOT, RESET_PASSWORD.

        Wipe is intentionally not implemented as an issueCommand call. AMAPI
        represents wiping by deleting the device resource, which needs its own
        explicit destructive-action flow.
        """
        service = self._get_service()

        command_map = {
            "lock": "LOCK",
            "reboot": "REBOOT",
            "reset_password": "RESET_PASSWORD",
        }

        api_command = command_map.get(command.lower())
        if not api_command:
            raise ValueError(
                f"Unknown command: {command}. "
                f"Supported: {', '.join(command_map.keys())}"
            )

        new_password = None
        if api_command == "RESET_PASSWORD":
            new_password = (params or {}).get("new_password", "")
            if not isinstance(new_password, str) or not new_password:
                raise ValueError("reset_password requires a non-empty new_password")

        if service is None:
            logger.warning(
                f"send_command: mock - would send {api_command} to {device_name}"
            )
            return {"command": api_command, "device": device_name, "status": "mock_sent"}

        try:
            body = {"type": api_command}
            if api_command == "RESET_PASSWORD":
                body["newPassword"] = new_password
                body["resetPasswordFlags"] = (params or {}).get(
                    "flags", ["REQUIRE_ENTRY"]
                )

            def _call():
                return (
                    service.enterprises()
                    .devices()
                    .issueCommand(name=device_name, body=body)
                    .execute()
                )

            result = await asyncio.to_thread(_call)
            logger.info(f"Command {api_command} sent to {device_name}")
            return result
        except Exception as e:
            logger.error(f"Failed to send command {api_command} to {device_name}: {e}")
            raise

    async def delete_device(
        self,
        device_name: str,
        wipe_data_flags: Optional[list[str]] = None,
    ) -> bool:
        """Delete (unenroll) a device from the enterprise."""
        service = self._get_service()

        if service is None:
            logger.warning(f"delete_device: mock - would delete {device_name}")
            return True

        try:
            params = {"name": device_name}
            if wipe_data_flags:
                params["wipeDataFlags"] = wipe_data_flags

            def _call():
                service.enterprises().devices().delete(**params).execute()

            await asyncio.to_thread(_call)
            logger.info(f"Device deleted: {device_name}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete device {device_name}: {e}")
            raise

    async def create_web_token(
        self, enterprise_name: str, parent_frame_url: str
    ) -> Optional[dict[str, Any]]:
        """
        Create a web token for the Managed Google Play iframe.
        The iframe allows admins to browse, search and select apps.
        """
        service = self._get_service()

        if service is None:
            logger.warning("create_web_token: returning mock data (no credentials)")
            return {
                "name": f"{enterprise_name}/webTokens/MOCK-TOKEN",
                "value": "MOCK_WEB_TOKEN_FOR_DEVELOPMENT",
                "parentFrameUrl": parent_frame_url,
            }

        try:
            def _call():
                return (
                    service.enterprises()
                    .webTokens()
                    .create(
                        parent=enterprise_name,
                        body={
                            "parentFrameUrl": parent_frame_url,
                            "enabledFeatures": [
                                "PLAY_SEARCH",
                                "PRIVATE_APPS",
                                "STORE_BUILDER",
                                "MANAGED_CONFIGURATIONS",
                            ],
                        },
                    )
                    .execute()
                )

            token = await asyncio.to_thread(_call)
            logger.info(f"Web token created for {enterprise_name}")
            return token
        except Exception as e:
            logger.error(f"Failed to create web token: {e}")
            raise

    async def get_application(
        self, enterprise_name: str, package_name: str
    ) -> Optional[dict[str, Any]]:
        """Get application details from the enterprise."""
        service = self._get_service()

        if service is None:
            logger.warning(f"get_application: returning mock data for {package_name}")
            return {
                "name": f"{enterprise_name}/applications/{package_name}",
                "title": package_name.split(".")[-1].title(),
                "permissions": [],
                "managedProperties": [],
            }

        try:
            def _call():
                return (
                    service.enterprises()
                    .applications()
                    .get(name=f"{enterprise_name}/applications/{package_name}")
                    .execute()
                )

            app = await asyncio.to_thread(_call)
            return app
        except Exception as e:
            logger.error(f"Failed to get application {package_name}: {e}")
            raise

    async def create_policy(
        self, enterprise_name: str, policy_id: str, policy_json: dict[str, Any]
    ) -> Optional[dict[str, Any]]:
        """Create or update a policy on the enterprise."""
        service = self._get_service()

        if service is None:
            logger.warning(f"create_policy: mock - would create policy {policy_id}")
            return {
                "name": f"{enterprise_name}/policies/{policy_id}",
                **policy_json,
            }

        try:
            def _call():
                return (
                    service.enterprises()
                    .policies()
                    .patch(
                        name=f"{enterprise_name}/policies/{policy_id}",
                        body=policy_json,
                    )
                    .execute()
                )

            policy = await asyncio.to_thread(_call)
            logger.info(f"Policy created/updated: {policy.get('name')}")
            return policy
        except Exception as e:
            logger.error(f"Failed to create policy {policy_id}: {e}")
            raise

    async def get_policy(self, policy_name: str) -> Optional[dict[str, Any]]:
        """Read the current policy resource from Android Management API."""
        service = self._get_service()

        if service is None:
            logger.warning("get_policy: returning mock data for %s", policy_name)
            return {"name": policy_name}

        try:
            def _call():
                return service.enterprises().policies().get(name=policy_name).execute()

            return await asyncio.to_thread(_call)
        except Exception as e:
            logger.error("Failed to get policy %s: %s", policy_name, type(e).__name__)
            raise
