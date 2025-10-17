import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, get } = deployments;

  const { deployer } = await getNamedAccounts();

  // Get the underlying token address
  const mockToken = await get("MockERC20");
  const underlyingTokenAddress = mockToken.address;

  // Deploy cToken wrapper
  const cToken = await deploy("cToken", {
    from: deployer,
    args: [underlyingTokenAddress, "Confidential USDT", "cUSDT"],
    log: true,
    deterministicDeployment: false,
  });

  console.log(`cToken deployed to: ${cToken.address}`);
  console.log(`Underlying token: ${underlyingTokenAddress}`);
};

export default func;
func.id = "deploy_ctoken";
func.tags = ["cToken", "token"];
func.dependencies = ["MockToken"];
