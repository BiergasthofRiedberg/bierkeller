# Instagram link list automation

The GitHub Actions workflow checks the connected professional Instagram account hourly. For each published post, it looks for a first-party comment containing a title and an HTTPS destination URL. It merges matching posts into `instagram-links.json`, keeps the `links` array newest first, preserves other JSON fields, and updates `stand` only when it adds a link. It does not publish to Instagram.

## Instagram comment format

Add this comment to each post that should appear on the link-in-bio page (or pin it as the first comment):

```text
Linktext: Der einzigartige Bierkeller
URL: https://www.riedberg.at/bier/bierkeller/
```

The script uses the post date in `Europe/Vienna` and extracts the `ALLES ... | ...` theme from the caption. Posts without that theme or without a matching comment from the configured account are skipped and reported in the Actions log. Existing entries are retained; duplicate date/theme entries are ignored.

## One-time setup

1. In Meta for Developers, authorize the Riedberg Instagram professional account for the Instagram API. The app needs access to basic account/media data and permission to read/manage comments (Instagram Login permissions `instagram_business_basic` and `instagram_business_manage_comments`; with Facebook Login, use the corresponding Instagram/Page permissions).
2. In repository Settings → Secrets and variables → Actions, add these repository secrets:
   - `IG_USER_ID`: Instagram professional account ID used by the API.
   - `IG_USERNAME`: account username, without `@`.
   - `IG_ACCESS_TOKEN`: the authorized access token. Treat it as a password; never commit it or paste it into chat.
3. Merge this branch into `main`. GitHub Actions then starts the schedule. Optionally run it immediately from the Actions tab using `workflow_dispatch`.

The workflow is intentionally inactive when secrets are missing. Token expiry or permission revocation requires renewing the Meta authorization and replacing the secret. Scheduled GitHub Actions can start later than the exact minute.
