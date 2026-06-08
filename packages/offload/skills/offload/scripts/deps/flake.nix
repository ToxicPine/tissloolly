{
  description = "Local dependencies for the offload skill";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  inputs.tissloolly = {
    url = "path:../../../../../..";
    flake = false;
  };

  outputs =
    { self, nixpkgs, tissloolly, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];

      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f system);

      pkgsFor =
        system:
        import nixpkgs {
          inherit system;
          config.allowUnfree = true;
        };
    in
    {
      packages = forAllSystems (
        system:
        let
          pkgs = pkgsFor system;
          foolfad-transports = pkgs.callPackage "${tissloolly.outPath}/packages/foolfad-transports" { };
        in
        {
          inherit foolfad-transports;
          default = foolfad-transports;
        }
      );

      devShells = forAllSystems (
        system:
        let
          pkgs = pkgsFor system;
          packages = selfPackages: [
            pkgs.bashInteractive
            pkgs.coreutils
            pkgs.curl
            pkgs.flyctl
            pkgs.git
            pkgs.jq
            pkgs.openssh
            pkgs.openssl
            selfPackages.foolfad-transports
          ];
        in
        {
          default = pkgs.mkShell {
            packages = packages self.packages.${system};
          };
        }
      );
    };
}
