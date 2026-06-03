# Connect the Target to Telegram

This is optional, only do it (once per target) when the user wants either feature:

- **Progress pings while offloaded work runs.** `nix run github:ToxicPine/tissloolly#vusperize -- --deliver telegram`
  sends updates to a Telegram chat.
- **Phone access to the agent in the target.** The user can message the Telegram bot instead of
  staying at a terminal.

Telegram is free. The bot token is a password. Treat it as secret and confirm before saving it.
If local `nix` is missing, run the same `nix ...` arguments through the offload skill's bundled
`scripts/nixie-nix.sh` helper from the skill directory.

## Plain Model

A Telegram bot is a Telegram account controlled by a program. The user creates the bot and receives
a long password called a **token**. Save that token on the target, then list the Telegram user IDs
allowed to talk to it. After that, messaging the bot messages the agent, and progress pings appear as
messages from the bot.

This does not change the user's normal Telegram account. It only lets that account chat with the new
bot.

## 1. Make the bot

The user creates the bot by talking to Telegram's official bot maker:

1. Open Telegram and search for **@BotFather** (or open https://t.me/BotFather).
2. Send `/newbot`.
3. Pick a display name (anything, e.g. "My Offload Agent").
4. Pick a username — it has to be unique and end in `bot` (e.g. `my_offload_bot`).
5. BotFather replies with the **token**, which looks like `123456789:ABCdef...`.

The token is the bot's password. If it leaks, the user can revoke it with `/revoke` in BotFather and
make a new one.

## 2. Get the user's Telegram ID

The target allows users by numeric Telegram user ID, such as `123456789`, **not** by `@username`.
The easiest way to find it: in Telegram, message
**@userinfobot** (https://t.me/userinfobot) and it replies with the ID. Save that number.

If more than one person should be allowed, collect each of their IDs.

## 3. Give the Target the Token and Allowed Users

These are secrets the _target itself_ needs, so store them in the target secret store, never in a
project. For the default Hettron Azure target, run these after `hettron-azure deploy`. Deploy already
exposes the final Container Apps URL as the secret-backed `HOSTNAME` environment variable.

Get the target resource group first:

```bash
hettron-azure --json show
```

Use `data.resourceGroupName` from the JSON when `data.setupState` is `container-app-deployed` or
`resource-group-exists`.

Set the Telegram secrets through `hettron-azure`; the command output does not include the values.
Container Apps secret names are short, lowercase names and do not need to match the environment
variable names:

```bash
hettron-azure set-secret --name telegram-bot-token --value "$TELEGRAM_BOT_TOKEN"
hettron-azure set-secret --name telegram-users --value "$TELEGRAM_ALLOWED_USERS"
```

Then expose those existing secrets as environment variables on the Container App:

```bash
az containerapp update \
  --resource-group <resource-group-from-show> \
  --name hettron-v0 \
  --set-env-vars \
    TELEGRAM_BOT_TOKEN=secretref:telegram-bot-token \
    TELEGRAM_ALLOWED_USERS=secretref:telegram-users
```

`TELEGRAM_ALLOWED_USERS` takes a comma-separated list when more than one person is allowed, e.g.
`111111111,222222222`.

Optionally, set a "home" chat. This is where the agent sends messages it starts, such as scheduled
results or `vusperize` pings when no chat is passed. For a normal one-on-one chat with the bot, use
the user's Telegram ID:

```bash
hettron-azure set-secret --name telegram-home --value "$TELEGRAM_HOME_CHANNEL"

az containerapp update \
  --resource-group <resource-group-from-show> \
  --name hettron-v0 \
  --set-env-vars TELEGRAM_HOME_CHANNEL=secretref:telegram-home
```

## 4. Check it works

The agent in the target reads these settings when its gateway runs. Have the user open Telegram,
find the new bot by username, and send it a message. It should answer within a few seconds.

If it stays silent, check the common causes:

- The token was mistyped.
- The user's numeric ID is missing from `TELEGRAM_ALLOWED_USERS`.
- The gateway was already running and has not read the new secrets yet. Restart the target if needed.

## Using it for offload progress pings

Once Telegram is connected, wrap a long remote command with `vusperize`:

```bash
nix run github:ToxicPine/tissloolly#foolfad -- -- bash -lc 'nix run github:ToxicPine/tissloolly#vusperize -- --deliver telegram -- <long command>'
```

If `TELEGRAM_HOME_CHANNEL` is set, pings go there automatically. To send them to a specific chat,
add `--deliver-chat-id <id>`. For a one-on-one chat with the bot, that ID is the user's own Telegram
ID.

## Where these settings live

The bot token, allowed users, and home chat belong to the _target_. Keep them in Azure Container Apps
secrets or the target's equivalent secret store, out of every project. Target credentials stay with
the target. Project-specific settings stay with the project.
