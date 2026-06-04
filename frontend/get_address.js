const { createWalletClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { arcTestnet } = require('viem/chains');

const account = privateKeyToAccount('0x37b59d30249d96de92e22f1263ba3f2dffe702ea584afcfa1d82ab3eccf87b6f');
console.log(account.address);
