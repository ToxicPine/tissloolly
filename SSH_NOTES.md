# SSH_NOTES.md

## Scope

Issue #7 asks for Stage 1 and Stage 2 research for the v1 two-hop transport:
Azure-native access to the VM host, then `docker exec -i <container> bash -s`
inside the Docker container, preserving stdin, stdout, stderr, and exit status
without static SSH keys or public inbound ports.

This run was blocked before a VM could be provisioned, so no transport proof was
completed and no `foolfad-hettron` prototype was added.

## Authoritative issue read

Command:

```sh
gh issue view 7 --repo ToxicPine/tissloolly --comments
```

Result: issue #7 and both comments were read before repo or Azure work. The
revised order of work limits this pass to stages 1 through 3 only.

## Client tooling

Command:

```sh
nix flake metadata --json
```

Observation: repo input `nixpkgs-unstable` was pinned to
`4df1b885d76a54e1aa1a318f8d16fd6005b6401f`.

Command:

```sh
nix shell .#foolfad-transports -c az version
```

Result: this started realizing the repo transport package. It fetched Azure CLI
2.86.0 from the pinned `nixpkgs-unstable`, but later failed while building the
unrelated `tailscale-lite` package because `/nix` ran out of inodes:

```text
mkdir .../go/pkg/mod/cache/download/...: no space left on device
error: Cannot build ... tailscale-lite-1.98.2-go-modules.drv
```

Command:

```sh
/nix/store/qcyqg0spx1y7wpfwygrj8ry83v13zskw-python3.13-azure-cli-2.86.0/bin/az version
```

Result before GC removed the unrooted store path:

```json
{
  "azure-cli": "2.86.0",
  "azure-cli-core": "2.86.0",
  "azure-cli-telemetry": "1.1.0",
  "extensions": {}
}
```

Command:

```sh
git ls-remote https://github.com/NixOS/nixpkgs refs/heads/nixpkgs-unstable
```

Result: live `nixpkgs-unstable` branch tip was
`ffa10e26ae11d676b2db836259889f1f571cb14f`, newer than the repo lock.

Command:

```sh
nix flake update nixpkgs-unstable
```

Result: failed while unpacking the current nixpkgs tree:

```text
error: creating file "/nix/store/tmp-26146-3215951821/x/pkgs/by-name/fl/flclash/package.nix": No space left on device
```

Command:

```sh
df -ih / /nix /data 2>/dev/null
```

Result at the time of failure:

```text
Filesystem     Inodes IUsed IFree IUse% Mounted on
none             512K  512K     0  100% /
none             512K  512K     0  100% /
/dev/vdc         640K  327K  314K   51% /data
```

Command:

```sh
nix build --out-link /data/homes/user/.cache/aztmp/azure-cli github:NixOS/nixpkgs/nixpkgs-unstable#azure-cli
```

Result: failed again while unpacking the live `nixpkgs-unstable` tree:

```text
error: creating directory "/nix/store/tmp-5603-1137978359/x/pkgs/by-name/v4": No space left on device
```

Conclusion: the newest live `az` from `nixpkgs-unstable` could not be realized
in this environment because `/nix` inode exhaustion prevented updating/fetching
the live nixpkgs tree. The only `az` version actually usable before GC removed
its unrooted output was Azure CLI 2.86.0 from the repo's pinned
`nixpkgs-unstable`.

## Azure CLI extensions

Microsoft documentation checked:

- https://learn.microsoft.com/en-us/azure/bastion/connect-vm-native-client-linux
- https://learn.microsoft.com/en-us/azure/bastion/native-client
- https://learn.microsoft.com/en-us/azure/bastion/bastion-entra-id-authentication

Relevant findings from the docs:

- Bastion native client connections require Standard SKU or higher.
- `az network bastion ssh` supports Microsoft Entra authentication for Linux
  VMs.
- `az network bastion tunnel` allows a native client tunnel but does not support
  Microsoft Entra authentication.
- Entra SSH requires the `AADSSHLoginForLinux` VM extension and the VM login RBAC
  role.

Command:

```sh
az extension list --output table
```

Initial result: no extensions installed.

Command:

```sh
TMPDIR=/data/homes/user/.cache/aztmp az extension add --name bastion --debug
```

Result: failed because the Nix-provided Python used by Azure CLI did not include
`pip`:

```text
/nix/store/.../python3.13: No module named pip
ERROR: An error occurred. Pip failed with status code 1.
```

Command:

```sh
TMPDIR=/data/homes/user/.cache/aztmp az extension add --name ssh --debug
```

Result: same pip failure.

Workaround command:

```sh
mkdir -p /data/homes/user/.cache/aztmp/manual-ext /home/user/.azure/cliextensions
curl -fsSL https://azcliprod.blob.core.windows.net/cli-extensions/bastion-1.4.3-py3-none-any.whl -o /data/homes/user/.cache/aztmp/manual-ext/bastion-1.4.3-py3-none-any.whl
/nix/store/60m4rxhg2fldqaak400c0lry96ijrzqn-python3-3.13.13/bin/python3.13 -m zipfile -e /data/homes/user/.cache/aztmp/manual-ext/bastion-1.4.3-py3-none-any.whl /home/user/.azure/cliextensions/bastion
curl -fsSL https://azcliprod.blob.core.windows.net/cli-extensions/ssh-2.0.8-py3-none-any.whl -o /data/homes/user/.cache/aztmp/manual-ext/ssh-2.0.8-py3-none-any.whl
/nix/store/60m4rxhg2fldqaak400c0lry96ijrzqn-python3-3.13.13/bin/python3.13 -m zipfile -e /data/homes/user/.cache/aztmp/manual-ext/ssh-2.0.8-py3-none-any.whl /home/user/.azure/cliextensions/ssh
```

Result:

```text
Name     Path                                     Version
bastion  /home/user/.azure/cliextensions/bastion  1.4.3
ssh      /home/user/.azure/cliextensions/ssh      2.0.8
```

Additional workaround for `ssh` extension dependencies:

```sh
curl -fsSL https://pypi.org/pypi/oschmod/0.3.12/json -o /data/homes/user/.cache/aztmp/manual-ext/oschmod-0.3.12.json
curl -fsSL https://pypi.org/pypi/oras/0.1.30/json -o /data/homes/user/.cache/aztmp/manual-ext/oras-0.1.30.json
# selected wheel URLs from the JSON, downloaded them, then unpacked with python -m zipfile
```

Result: `az ssh vm --help` still failed, because `oras` also needed
`jsonschema` and transitive dependencies:

```text
ModuleNotFoundError: No module named 'jsonschema'
```

`az network bastion ssh --help` did load after the manual `bastion` extension
unpack. It showed this key argument:

```text
<SSH_ARGS> : Additional arguments passed to OpenSSH.
```

Useful implication, not live-verified: the cleanest candidate transport is
probably:

```sh
az network bastion ssh \
  --name "$BASTION" \
  --resource-group "$RG" \
  --target-resource-id "$VM_ID" \
  --auth-type AAD \
  -- -T docker exec -i hettron bash -s
```

That avoids `az network bastion tunnel`, keeps Entra auth on the host hop, and
passes a real OpenSSH remote command through Bastion. The probe script should be
piped to this command on stdin. This remains unverified because VM provisioning
was blocked.

## Azure account

Command:

```sh
az account show --output json
```

Result:

```json
{
  "environmentName": "AzureCloud",
  "id": "cefec7d4-2205-4a64-863b-5793485af94e",
  "isDefault": true,
  "name": "Azure subscription 1",
  "state": "Enabled",
  "tenantId": "f602ce6c-fbda-49d7-9b62-2b19230b3ba1",
  "user": {
    "name": "arbion@cocaine.ninja",
    "type": "user"
  }
}
```

Command:

```sh
az ad signed-in-user show --query '{id:id,userPrincipalName:userPrincipalName}' --output json
```

Result:

```json
{
  "id": "89efde7d-58f1-4cee-89dc-fbf033a4ebc7",
  "userPrincipalName": "arbion_cocaine.ninja#EXT#@arbioncocaine.onmicrosoft.com"
}
```

## Stage 1 partial rig commands

Resource prefix:

```sh
tiss-i7-s1-20260604173959
```

Command:

```sh
az group create --name tiss-i7-s1-20260604173959 --location eastus --tags purpose=issue7-stage1 owner=codex dispose=true --output json
```

Result: succeeded.

Command:

```sh
az network vnet create \
  --resource-group tiss-i7-s1-20260604173959 \
  --location eastus \
  --name tiss-i7-s1-vnet \
  --address-prefixes 10.77.0.0/16 \
  --subnet-name vm \
  --subnet-prefixes 10.77.0.0/24 \
  --output json
```

Result: Azure auto-registered `Microsoft.Network`; registration then succeeded
and the VNet/subnet were created.

Command:

```sh
az network vnet subnet create \
  --resource-group tiss-i7-s1-20260604173959 \
  --vnet-name tiss-i7-s1-vnet \
  --name AzureBastionSubnet \
  --address-prefixes 10.77.1.0/26 \
  --output json
```

Result: succeeded.

Command:

```sh
az network nsg create \
  --resource-group tiss-i7-s1-20260604173959 \
  --location eastus \
  --name tiss-i7-s1-vm-nsg \
  --output json
```

Result: succeeded.

Command:

```sh
az network nsg rule create \
  --resource-group tiss-i7-s1-20260604173959 \
  --nsg-name tiss-i7-s1-vm-nsg \
  --name AllowBastionSsh \
  --priority 100 \
  --direction Inbound \
  --access Allow \
  --protocol Tcp \
  --source-address-prefixes 10.77.1.0/26 \
  --source-port-ranges '*' \
  --destination-address-prefixes '*' \
  --destination-port-ranges 22 \
  --output json
```

Result: succeeded.

Command:

```sh
az network nsg rule create \
  --resource-group tiss-i7-s1-20260604173959 \
  --nsg-name tiss-i7-s1-vm-nsg \
  --name DenyAllInboundBeforeDefaults \
  --priority 200 \
  --direction Inbound \
  --access Deny \
  --protocol '*' \
  --source-address-prefixes '*' \
  --source-port-ranges '*' \
  --destination-address-prefixes '*' \
  --destination-port-ranges '*' \
  --output json
```

Result: succeeded. This rule overrides the default `AllowVnetInBound`.

Command:

```sh
az network vnet subnet update \
  --resource-group tiss-i7-s1-20260604173959 \
  --vnet-name tiss-i7-s1-vnet \
  --name vm \
  --network-security-group tiss-i7-s1-vm-nsg \
  --output json
```

Result: succeeded.

Command:

```sh
ssh-keygen -t ed25519 -N '' -C issue7-stage1-disposable -f /data/homes/user/.cache/aztmp/issue7-s1/bootstrap_key
```

Result: succeeded. This was a disposable Azure VM provisioning key only. It was
not used for transport. The plan was to remove it from the VM with Azure Run
Command after installing `AADSSHLoginForLinux`; provisioning failed before that
step.

Command:

```sh
az vm create \
  --resource-group tiss-i7-s1-20260604173959 \
  --location eastus \
  --name tiss-i7-s1-vm \
  --image Ubuntu2404 \
  --size Standard_B1s \
  --vnet-name tiss-i7-s1-vnet \
  --subnet vm \
  --public-ip-address "" \
  --nsg "" \
  --admin-username azureuser \
  --authentication-type ssh \
  --ssh-key-values /data/homes/user/.cache/aztmp/issue7-s1/bootstrap_key.pub \
  --storage-sku Standard_LRS \
  --os-disk-size-gb 30 \
  --output json
```

Result: failed during template preflight:

```text
SkuNotAvailable: Standard_B1s is currently not available in location 'eastus'
```

Command:

```sh
az vm create ... --size Standard_B2s ...
```

Result: failed during template preflight:

```text
SkuNotAvailable: Standard_B2s is currently not available in location 'eastus'
```

Command:

```sh
az vm create ... --size Standard_D2s_v5 ...
```

Result: failed during template preflight:

```text
QuotaExceeded: eastus Current Limit: 0 for standardDSv5Family Cores; Additional Required: 2
```

After this, the unrooted Azure CLI store output was removed by GC and the direct
live `nixpkgs-unstable#azure-cli` build also failed with `/nix/store` inode
exhaustion, so no further Azure provisioning could be driven with `az`.

## Stage 2 teardown

Because Stage 1 created a disposable resource group, VNet, subnets, and NSG
before VM provisioning failed, teardown was done through Azure Resource Manager
REST using the existing Azure CLI MSAL ARM token. Token values were not printed
or recorded.

Command:

```sh
curl -sS -i -X DELETE \
  "https://management.azure.com/subscriptions/cefec7d4-2205-4a64-863b-5793485af94e/resourcegroups/tiss-i7-s1-20260604173959?api-version=2021-04-01" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Length: 0"
```

Result:

```text
HTTP/2 202
```

Command:

```sh
curl -sS -o /tmp/issue7-s1-rg-status.json -w '%{http_code}' \
  "https://management.azure.com/subscriptions/cefec7d4-2205-4a64-863b-5793485af94e/resourcegroups/tiss-i7-s1-20260604173959?api-version=2021-04-01" \
  -H "Authorization: Bearer ${TOKEN}"
```

Polling result:

```text
poll=1 http=200
poll=2 http=200
poll=3 http=200
poll=4 http=200
poll=5 http=200
poll=6 http=200
poll=7 http=200
poll=8 http=200
poll=9 http=404
```

Final response:

```json
{
  "error": {
    "code": "ResourceGroupNotFound",
    "message": "Resource group 'tiss-i7-s1-20260604173959' could not be found."
  }
}
```

Stage 2 teardown is verified.

## Conclusion

Recommended mechanism from documentation and CLI shape, not live-verified:

```sh
az network bastion ssh \
  --name "$BASTION" \
  --resource-group "$RG" \
  --target-resource-id "$VM_ID" \
  --auth-type AAD \
  -- -T docker exec -i hettron bash -s
```

Reasoning:

- It keeps the host hop Azure-native and Entra-authenticated.
- It avoids static SSH keys for the actual transport.
- It needs no VM public IP and no public inbound SSH.
- It passes a real OpenSSH remote command, so `docker exec -i ... bash -s`
  should receive stdin and propagate stdout, stderr, and exit status naturally.
- It avoids `az network bastion tunnel`, whose documented limitation is that
  Microsoft Entra authentication is not supported.

Required live probe, still unverified:

```sh
cat <<'PROBE' | az network bastion ssh \
  --name "$BASTION" \
  --resource-group "$RG" \
  --target-resource-id "$VM_ID" \
  --auth-type AAD \
  -- -T docker exec -i hettron bash -s
printf 'probe stdout\n'
printf 'probe stderr\n' >&2
exit 37
PROBE
```

Expected proof criteria: local stdout contains only `probe stdout`, local stderr
contains only `probe stderr` plus any Azure/OpenSSH diagnostics, and the local
process exits 37. This proof could not be run because VM provisioning was blocked
by eastus capacity/quota and the required live `nixpkgs-unstable` Azure CLI could
not be realized due `/nix` inode exhaustion.
