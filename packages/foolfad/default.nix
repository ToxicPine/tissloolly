{ pkgs, ... }:

pkgs.writeShellApplication {
  name = "foolfad";
  runtimeInputs = with pkgs; [
    coreutils
    flyctl
    git
    gnugrep
    util-linux
  ];
  text = builtins.readFile ./foolfad.sh;
}
