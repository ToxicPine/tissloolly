{ pkgs, ... }:

pkgs.writeShellApplication {
  name = "foolfad";
  runtimeInputs = with pkgs; [
    coreutils
    git
    gnugrep
    util-linux
  ];
  text = builtins.readFile ./foolfad.sh;
}
