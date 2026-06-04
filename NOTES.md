# NOTES.md

## Stage 3 status

Stage 3 was not started.

Issue #7 orders Stage 3 after Stage 1 transport research and Stage 2 teardown:
on a freshly set up Azure account/context, provision the full v1 deployment by
hand, one command at a time, folding in the verified transport wisdom from
`SSH_NOTES.md`.

That prerequisite was not met in this run:

- Stage 1 could not provision a VM in the disposable Azure rig.
- `Standard_B1s` and `Standard_B2s` were unavailable in `eastus`.
- `Standard_D2s_v5` was blocked by subscription quota in `eastus`
  (`standardDSv5Family` current limit 0, required 2).
- Updating/realizing the live `nixpkgs-unstable` Azure CLI was blocked by
  `/nix/store` inode exhaustion.
- The only usable Azure CLI output was an unrooted pinned `nixpkgs-unstable`
  Azure CLI 2.86.0 path, which was later removed by GC.

Because the transport proof was not verified, there is no leak-free full v1
command sequence to record as validated.

## Commands that were not run

No Stage 3 full deployment commands were run. In particular, this run did not:

- create production-like v1 app resources;
- open ingress;
- configure Easy Auth;
- connect a proxy to a VM;
- test unauthenticated reachability for the full deployment;
- implement the automated v1 flow.

## Conclusion

No recommended leak-free command sequence is verified yet.

The strongest current candidate from `SSH_NOTES.md` is to build the full v1
sequence around these constraints from the start:

- create private VM networking first;
- install `AADSSHLoginForLinux` and assign Entra VM login RBAC before transport
  use;
- deploy Standard Azure Bastion with native client support;
- use `az network bastion ssh --auth-type AAD -- -T docker exec -i hettron bash -s`
  for the host hop plus container hop;
- configure Easy Auth and NSG restrictions before any proxy can reach the VM and
  before ingress is opened.

This remains a proposed sequence, not a verified Stage 3 result.
