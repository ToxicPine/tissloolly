{ pkgs, ... }:

# foolfad transport adapters, shipped as one package. Each adapter is a small
# command that takes a script on stdin, runs it under "bash -s" on the remote,
# and forwards stdout/stderr and the exit status — the contract foolfad expects
# from FOOLFAD_TRANSPORT. They differ only in how they reach the machine.
let
  # `tailscale ssh` only talks to the local tailscaled socket and then execs the
  # system ssh; it never runs the daemon itself. So the adapter needs just the
  # client CLI, not tailscaled. nixpkgs' `tailscale` builds the daemon and
  # symlinks `tailscale` -> `tailscaled`, wrapping it with iproute2/iptables/
  # shadow/procps on PATH — and procps drags libsystemd into the closure.
  # Building only cmd/tailscale gives a standalone client binary and drops all of
  # that daemon baggage (no systemd).
  tailscaleClient = pkgs.tailscale.overrideAttrs (old: {
    pname = "tailscale-client";
    subPackages = [ "cmd/tailscale" ];
    outputs = [ "out" ];
    postInstall = ""; # skip tailscaled wrapping, the systemd unit, and the symlink
  });

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
    # tailscale ssh execs the system ssh, so openssh is required alongside it.
    (mkAdapter "foolfad-tailscale" [ tailscaleClient pkgs.openssh ])
    (mkAdapter "foolfad-fly" [ pkgs.flyctl ])
  ];
}
