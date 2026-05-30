{ pkgs, ... }:

# foolfad transport adapters, shipped as one package. Each adapter is a small
# command that takes a script on stdin, runs it under "bash -s" on the remote,
# and forwards stdout/stderr and the exit status — the contract foolfad expects
# from FOOLFAD_TRANSPORT. They differ only in how they reach the machine.
let
  mkAdapter = name: runtimeInputs:
    pkgs.writeShellApplication {
      inherit name runtimeInputs;
      text = builtins.readFile (./. + "/${name}.sh");
    };
in
pkgs.symlinkJoin {
  name = "foolfad-transports";
  paths = [
    (mkAdapter "foolfad-ssh" [ pkgs.openssh ])
    (mkAdapter "foolfad-tailscale" [ pkgs.tailscale ])
    (mkAdapter "foolfad-fly" [ pkgs.flyctl ])
  ];
}
