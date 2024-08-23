const TronWeb = require('tronweb');
const rl = require('readline-sync');
const fs = require('node:fs');
const dotenv = require('dotenv');
dotenv.config();

const { HttpProvider } = TronWeb.providers;
const TRON_FULL_NODE = new HttpProvider("https://api.trongrid.io");
const TRON_SOLIDITY_NODE = new HttpProvider("https://api.trongrid.io");
const TRON_EVENT_SERVER = new HttpProvider("https://api.trongrid.io");

const CONFIG = {
    SUN_PUMP_ROUTER_ADDRESS: 'TZFs5ch1R1C4mmjwrrmZqeqbUgGpxY1yWB',
    SUN_PAD_LAUNCHPAD_ADDRESS: 'TTfvyrAz86hbZk5iDpKD78pqLGgi8C7AAw',
    WTRX_ADDRESS: 'TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR',
    FEE_LIMIT: 100000000,
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const loadContract = async (tronWeb, abiPath, address) => {
    const abi = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
    return await tronWeb.contract(abi, address);
};

const checkBonding = async (sunPumpRouterContract, address) => {
    return await sunPumpRouterContract.isSunPumpToken(address).call();
};

const getBalance = async (tokenContract, address) => {
    return await tokenContract.balanceOf(address).call();
};

const getMinTokenToBuy = async (sunPadLaunchpadContract, tokenAddress, trxAmount) => {
    const result = await sunPadLaunchpadContract.getTokenAmountByPurchaseWithFee(tokenAddress, trxAmount).call();
    return result[0].toString();
};

const getTRXAmountBySale = async (sunPadLaunchpadContract, tokenAddress, balanceToken) => {
    const result = await sunPadLaunchpadContract.getTrxAmountBySaleWithFee(tokenAddress, balanceToken).call();
    return result[0].toString();
};

const getAmountsOutSundotIO = async (sunPumpRouterContract, amountInSun, path) => {
    return await sunPumpRouterContract.methods.getAmountsOut(amountInSun, path).call();
};

const executeTransaction = async (transaction, callValue = 0) => {
    const tx = await transaction.send({
        callValue,
        feeLimit: CONFIG.FEE_LIMIT,
    });
    console.log('Transaction:', `https://tronscan.org/#/transaction/${tx}`);
    return tx;
};

const approveToken = async (tokenContract, contractAddress, address) => {
    const allowance = await tokenContract.allowance(address, contractAddress).call();
    if (Number(allowance) > 0) return;

    const maxUint256 = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    const approveFunction = tokenContract.approve(contractAddress, maxUint256);
    await executeTransaction(approveFunction);
    console.log("Approve success");
};

const buyToken = async (contract, tokenAddress, trxAmount, isSunPump) => {
    if (isSunPump) {
        const minAmountToBuy = await getMinTokenToBuy(contract, tokenAddress, trxAmount);
        return contract.purchaseToken(tokenAddress, minAmountToBuy);
    } else {
        const path = [CONFIG.WTRX_ADDRESS, tokenAddress].map(addr => '0x' + TronWeb.address.toHex(addr).slice(2));
        const amountsOut = await getAmountsOutSundotIO(contract, trxAmount, path);
        return contract.swapExactETHForTokens(
            amountsOut.amounts[1],
            path,
            TronWeb.address.fromPrivateKey(process.env.PRIVATE_KEY),
            Math.floor(Date.now() / 1000) + 60 * 10
        );
    }
};

const sellToken = async (contract, tokenAddress, tokenAmount, isSunPump) => {
    if (isSunPump) {
        const minTrxAmountBySale = await getTRXAmountBySale(contract, tokenAddress, tokenAmount);
        return contract.saleToken(tokenAddress, tokenAmount, minTrxAmountBySale);
    } else {
        const path = [tokenAddress, CONFIG.WTRX_ADDRESS].map(addr => '0x' + TronWeb.address.toHex(addr).slice(2));
        const amountsOut = await getAmountsOutSundotIO(contract, tokenAmount, path);
        return contract.swapExactTokensForETH(
            tokenAmount,
            amountsOut.amounts[1],
            path,
            TronWeb.address.fromPrivateKey(process.env.PRIVATE_KEY),
            Math.floor(Date.now() / 1000) + 60 * 10
        );
    }
};

const getEstimatedTRXForSell = async (contract, tokenAddress, tokenAmount, isSunPump) => {
    if (isSunPump) {
        return await getTRXAmountBySale(contract, tokenAddress, tokenAmount);
    } else {
        const path = [tokenAddress, CONFIG.WTRX_ADDRESS].map(addr => '0x' + TronWeb.address.toHex(addr).slice(2));
        const amountsOut = await getAmountsOutSundotIO(contract, tokenAmount, path);
        return amountsOut.amounts[1].toString();
    }
};

const main = async () => {
    while (true) {
        try {
            const tronWeb = new TronWeb(TRON_FULL_NODE, TRON_SOLIDITY_NODE, TRON_EVENT_SERVER, process.env.PRIVATE_KEY);
            const address = tronWeb.address.fromPrivateKey(process.env.PRIVATE_KEY);
            const balanceInSun = await tronWeb.trx.getBalance(address);

            const sunPumpRouterContract = await loadContract(tronWeb, './abi/abiSunPumpRouter.json', CONFIG.SUN_PUMP_ROUTER_ADDRESS);
            const sunPadLaunchpadContract = await loadContract(tronWeb, './abi/abiSunpad.json', CONFIG.SUN_PAD_LAUNCHPAD_ADDRESS);

            console.log(`Address: ${address}\nBalance: ${Number(balanceInSun)/10**6} TRX\n`);
            console.log('1. Swap TRX to Token\n2. Sale Token to TRX');
            const choice = rl.question('Choice: ');

            if (choice == 1) {
                const tokenAddress = rl.question('Token Address: ');
                const trxAmount = Number(rl.question('TRX Amount: '));

                const isSunPump = !await checkBonding(sunPumpRouterContract, tokenAddress);
                const contract = isSunPump ? sunPadLaunchpadContract : sunPumpRouterContract;

                if (rl.keyInYN('Are you sure you want to buy this token?')) {
                    const transaction = await buyToken(contract, tokenAddress, tronWeb.toSun(trxAmount), isSunPump);
                    await executeTransaction(transaction, tronWeb.toSun(trxAmount));

                    const tokenContract = await loadContract(tronWeb, './abi/abitoken.json', tokenAddress);
                    await approveToken(tokenContract, isSunPump ? CONFIG.SUN_PAD_LAUNCHPAD_ADDRESS : CONFIG.SUN_PUMP_ROUTER_ADDRESS, address);
                } else {
                    console.log('Buy operation cancelled.');
                }
            } else if (choice == 2) {
                const tokenAddress = rl.question('Token Address: ');
                const isSunPump = !await checkBonding(sunPumpRouterContract, tokenAddress);
                const contract = isSunPump ? sunPadLaunchpadContract : sunPumpRouterContract;

                const tokenContract = await loadContract(tronWeb, './abi/abitoken.json', tokenAddress);
                const balanceToken = await getBalance(tokenContract, address);
                console.log(`Balance Token: ${Number(balanceToken)/10**16}`);

                const estimatedTRX = await getEstimatedTRXForSell(contract, tokenAddress, balanceToken, isSunPump);
                console.log(`Estimated TRX to receive: ${tronWeb.fromSun(estimatedTRX)} TRX`);
                
                if (rl.keyInYN('Are you sure you want to sell all your tokens?')) {
                    const transaction = await sellToken(contract, tokenAddress, balanceToken, isSunPump);
                    await executeTransaction(transaction);
                } else {
                    console.log('Sell operation cancelled.');
                }
            }
        } catch (error) {
            console.error('An error occurred:', error);
        }
    }
};

main();