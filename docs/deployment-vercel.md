# Vercel Deployment

The application stores its persistent data in the `maplelog-3ba66` Firestore
database in Seoul. The SQLite database was removed after a verified migration.
Firestore rules deny direct browser access; the Next.js server uses the Admin
SDK with a service account. The official auction collector still needs the
owner's authenticated local Chrome profile.

## Connect the repository

1. Commit and push the current project changes to
   `github.com/byoungyoon/maplelog`.
2. In the [Vercel dashboard](https://vercel.com/new), choose **Add New →
   Project**, select the GitHub repository, and keep the Next.js framework and
   repository root.
3. Use `npm run build -- --webpack` as the build command. This is the production
   build verified for the current code.
4. Set the environment variables below for **Production** before publishing.
   Preview deployments need their own variables if they should access data;
   avoid pointing untrusted previews at the live Firestore project.
5. After Vercel assigns the production URL, optionally set `APP_ORIGIN` to its
   exact `https://...` origin and redeploy. If omitted, the request Host and
   forwarded HTTPS protocol are checked. Use the final custom domain if one is
   configured.

| Variable | Value |
| --- | --- |
| `FIREBASE_PROJECT_ID` | `maplelog-3ba66` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Complete JSON from the private service-account file, configured as a sensitive server-only variable. |
| `CREDENTIAL_ENCRYPTION_KEY` | Hex encoding of the existing 32-byte `.local-secrets/credential.key`; it must be the same key used before migration so the stored Nexon key can be decrypted. |
| `SESSION_SECRET` | A private random string of at least 32 characters. |
| `APP_ORIGIN` | Optional exact production origin, such as `https://maplelog-khaki.vercel.app`. |

Do not upload `.env`, `.local-secrets`, the Chrome profile, or a service-account
file to Git. Do not use `NEXT_PUBLIC_` for any variable above. Vercel's
[environment variable settings](https://vercel.com/docs/environment-variables)
support server-only secrets.

## Background work

Keep `npm run worker` on a connected computer for Nexon scheduler polling. The
official auction collector also runs on that computer with
`npm run auction:refresh` because it uses headed Chrome and a local login
profile. Its observations and resulting prices are stored in Firestore, so the
Vercel app reads the same data. The intended Dots schedule is 10:00
Asia/Seoul daily, but it has not been created from this session; see
[the auction procedure](../kb/auction-daily.md).

## Verification

After deployment, sign in with a valid Nexon API key, check that the Prices page
shows 27 priced Vera auction items, and confirm the recent collection time.
The live Firestore ledger currently has revision 1648, with 27 priced and 40
unpriced items. Check the Vercel Function logs for Firebase credential or origin errors
if setup fails. Do not disconnect the Nexon key while testing unless intended.
The original migrated account keeps its existing root Firestore data. Another
Nexon account receives isolated data under `accounts/{accountSignature}`.
