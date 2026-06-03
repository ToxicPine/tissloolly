{
  description = "Silly Tools, TiSslooly";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  inputs.nixpkgs-unstable.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  inputs.automate-accounts = {
    url = "github:ToxicPine/automate-accounts";
    flake = false;
  };
  inputs.google-workspace-cli = {
    url = "github:googleworkspace/cli";
    flake = false;
  };

  outputs =
    { self, nixpkgs, nixpkgs-unstable, automate-accounts, google-workspace-cli, ... }:
    let
      skills = import ./skills.nix { lib = nixpkgs.lib; };

      forAllSystems =
        f:
        nixpkgs.lib.genAttrs nixpkgs.lib.systems.flakeExposed (
          system:
          let
            pkgs = import nixpkgs {
              localSystem.system = system;
              config.allowUnfree = true;
            };
            unstablePkgs = import nixpkgs-unstable {
              localSystem.system = system;
              config.allowUnfree = true;
            };
          in
          f pkgs unstablePkgs
        );

      packagesWithSkills = [
        {
          name = "boondoggle";
          skillsPath = ./packages/boondoggle/skills;
        }
        {
          name = "foolfad";
          skillsPath = ./packages/foolfad/skills;
        }
        {
          name = "foolfad-config";
          skillsPath = ./packages/foolfad-config/skills;
        }
        {
          name = "offload";
          skillsPath = ./packages/offload/skills;
        }
        {
          name = "ghwc";
          skillsPath = ./packages/ghwc/skills;
        }
        {
          name = "ghwrc";
          skillsPath = ./packages/ghwrc/skills;
        }
        {
          name = "vusperize";
          skillsPath = ./packages/vusperize/skills;
        }
        {
          name = "account-automation";
          skillsPath = automate-accounts + "/skills";
        }
        {
          name = "google-workspace";
          skillsPath = google-workspace-cli + "/skills";
        }
      ];
    in
    {
      packages = forAllSystems (
        pkgs: unstablePkgs:
        {
          prasskitte = pkgs.callPackage ./packages/prasskitte { };
          boondoggle = pkgs.callPackage ./packages/boondoggle { };
          foolfad = pkgs.callPackage ./packages/foolfad { };
          foolfad-config = pkgs.callPackage ./packages/foolfad-config { };
          foolfad-transports = pkgs.callPackage ./packages/foolfad-transports { inherit unstablePkgs; };
          ghwc = pkgs.callPackage ./packages/ghwc { };
          ghwrc = pkgs.callPackage ./packages/ghwrc { };
          hettron-azure = unstablePkgs.callPackage ./packages/hettron-azure {};
          vusperize = pkgs.callPackage ./packages/vusperize { };
          # poltrock = pkgs.callPackage ./packages/poltrock { };
          default = pkgs.writeShellApplication {
            name = "tissloolly";
            text = ''
              echo "hello from tissloolly"
            '';
          };
        }
        // skills.mkSkillsPackages pkgs packagesWithSkills
      );

      homeModules = skills.mkSkillsHomeModules {
        inherit self;
        packages = packagesWithSkills;
      };
    };
}
