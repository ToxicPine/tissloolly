{ pkgs, ... }:

pkgs.writeShellApplication {
  name = "foolfad-ssh";
  runtimeInputs = with pkgs; [
    openssh
  ];
  text = builtins.readFile ./foolfad-ssh.sh;
}
