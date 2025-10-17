import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  // Deploy Mock Token for testing
  const mockToken = await deploy("MockERC20", {
    from: deployer,
    args: ["Mock USDT", "mUSDT", 6],
    log: true,
    deterministicDeployment: false,
  });

  console.log(`MockERC20 deployed to: ${mockToken.address}`);
};

export default func;
func.id = "deploy_mock_token";
func.tags = ["MockToken", "token"];
