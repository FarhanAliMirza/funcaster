# Operator-managed creator publishing

Set `CREATOR_STORE` to a private persistent directory used by both the server and these commands (default `.local/creator-registry`). Keep it outside static content. Commands run locally under the operator's OS account; owner/reviewer names record attribution, not public login credentials. A lock prevents concurrent CLI writes. Registry changes are atomic, audited and capped at 200 versions / 500 MB of source assets.

1. Reserve a namespace: `npm run game:registry -- namespace studio --owner "Creator name"`.
2. The creator runs `npm run game:create -- my-game --namespace studio`, edits, validates and tests the complete bundle with `game:preview`.
3. Submit a snapshot: `npm run game:registry -- submit creator-games/my-game --owner "Creator name"`. Save the returned submission ID. The game/version is immutable; fixes require a higher version.
4. Inspect: `npm run game:registry -- inspect SUBMISSION_ID`. Review the exact submitted assets and game in the sandbox. Record rejection with `reject SUBMISSION_ID --reviewer "Reviewer" --note "Reason for rejection"`, or approval with `approve SUBMISSION_ID --reviewer "Reviewer" --note "Review evidence" --assetRights --sandbox --playability`.
5. After a real outside creator completes the workflow, record who, build, devices and outcome: `npm run game:registry -- accept-trial --note "Actual external creator trial evidence"`. Do not use generated fixtures as this acceptance evidence.
6. Publish the reviewed hash: `npm run game:registry -- publish SUBMISSION_ID`. It appears at `/community/`. `catalog` lists public entries; `list` lists submissions.
7. Withdraw immediately with `npm run game:registry -- withdraw SUBMISSION_ID --note "Reason for withdrawal"`. Subsequent gallery and bundle requests return no published game; already loaded code cannot be recalled from a browser.

Review, publication and bundle loading validate stored hashes. Publication fails before trial acceptance or without all three review checks. No creator code runs in Node. The gallery allows scripts and bundled resources only in an opaque-origin sandbox; no third-party network, sockets, room credentials, parent access, workers or nested frames.

The initial gallery is for standalone keyboard/pointer games with casual results. Public self-service accounts/uploads and live party SDK grants are separate future scope. The real registry starts empty; synthetic automated/browser QA uses temporary directories and does not enable production publication.
