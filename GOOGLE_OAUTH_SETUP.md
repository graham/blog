# Google OAuth setup

The recommended path is `npm run setup`. Choose Google or Both and the wizard will print the exact values, collect the credentials without echoing the secret, and configure the selected Convex deployment.

For manual setup:

1. Open the [Google Auth Platform](https://console.cloud.google.com/auth/overview) and create or select a project.
2. Configure the app name, support email, and audience.
3. For an external app in testing mode, add accounts under [Audience](https://console.cloud.google.com/auth/audience).
4. Open [Clients](https://console.cloud.google.com/auth/clients), create an OAuth client, and choose **Web application**.
5. Add `https://<deployment>.convex.site` as an authorized JavaScript origin.
6. Add `https://<deployment>.convex.site/api/auth/callback/google` as an authorized redirect URI.

Convex Auth handles the callback through the `.convex.site` host. The callback is not the browser's `/signin` page and never uses `.convex.cloud`.

Set the credentials and enable the provider on the same deployment:

```bash
npx convex env set AUTH_GOOGLE_ID
npx convex env set AUTH_GOOGLE_SECRET
npx convex env set AUTH_GOOGLE_ENABLED true
```

Omit each secret value to let the CLI read it privately from stdin. Set `SITE_URL` to the public origin, add administrator emails to `ADMIN_USERS` and `ALLOW_USERS`, then redeploy.
