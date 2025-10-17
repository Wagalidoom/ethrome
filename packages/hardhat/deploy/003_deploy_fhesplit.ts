import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy, get } = deployments;

  const { deployer } = await getNamedAccounts();
  const signers = await ethers.getSigners();

  // Get cToken contract address
  const cToken = await get("cToken");

  // Use deployer as XMTP bot address for testing (in production, use actual bot address)
  const xmtpBotAddress = deployer;

  // Deploy FHESplit
  const fheSplit = await deploy("FHESplit", {
    from: deployer,
    args: [cToken.address, xmtpBotAddress],
    log: true,
    deterministicDeployment: false,
  });

  console.log(`FHESplit deployed to: ${fheSplit.address}`);
  console.log(`cToken: ${cToken.address}`);
  console.log(`XMTP Bot Address: ${xmtpBotAddress}`);

  // Log deployment summary
  const mockToken = await get("MockERC20");
  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log(`Network: ${hre.network.name}`);
  console.log(`Deployer: ${deployer}`);
  console.log(`MockERC20: ${mockToken.address}`);
  console.log(`cToken: ${cToken.address}`);
  console.log(`FHESplit: ${fheSplit.address}`);
  console.log(`XMTP Bot: ${xmtpBotAddress}`);
  console.log("========================\n");
};

export default func;
func.id = "deploy_fhesplit";
func.tags = ["FHESplit", "split"];
func.dependencies = ["cToken"];
