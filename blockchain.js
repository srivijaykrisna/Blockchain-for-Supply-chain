const sha256 = require('sha256');
const currentNodeUrl = process.argv[3];
const uuid = require('uuid/v1');

function Blockchain() {
	this.chain = [];
	this.pendingChain = [];

	this.currentNodeUrl = currentNodeUrl;
	this.networkNode = [];

	this.createNewBlock(100, '0', '0');
};


Blockchain.prototype.createNewBlock = function(nonce, previousBlockHash, hash) {
	const newBlock = {
		index: this.chain.length + 1,
		timestamp: Date.now(),
		transactions: this.pendingChain,
		nonce: nonce,
		hash: hash,
		previousBlockHash: previousBlockHash
	};

	this.pendingChain = [];
	this.chain.push(newBlock);

	return newBlock;
};


Blockchain.prototype.getLastBlock = function() {
	return this.chain[this.chain.length -1];
};


Blockchain.prototype.createNewTransaction = function(Station, Manufacturer_Name, Process, Role, Component, Material, Category, Quantity, From, Destination, status, amount) {
	const newTransaction = {

		Station: Station,	
		Manufacturer_Name: Manufacturer_Name,
		Process: Process,
		Role: Role,
		Component: Component,
		Material: Material,
		Category: Category,
		Quantity: Quantity,
		From: From,
		Destination: Destination,
		status: status,
		amount: amount,
		ChainId: uuid().split('-').join('')
	};

	return newTransaction;
};

Blockchain.prototype.addTransactionTopendingChain = function(transactionObj) {
	this.pendingChain.push(transactionObj);

	return this.getLastBlock()['index']+1;
};

Blockchain.prototype.hashBlock = function(previousBlockHash, currentBlockData, nonce) {
	const dataAsString = previousBlockHash + nonce.toString() + JSON.stringify(currentBlockData);
	const hash = sha256(dataAsString);
	return hash;
};



Blockchain.prototype.proofOfWork = function(previousBlockHash,currentBlockData) {
	let nonce = 0;
	let hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
	while (hash.substring (0,4)!== '0000'){
		nonce ++;
		hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
		
	};

	return nonce;	
};


Blockchain.prototype.chainIsValid = function(blockchain) {
	let validChain = true;

	for(var i = 1; i < blockchain.length; i++) {
		const currentBlock = blockchain[i];
		const prevBlock =  blockchain[i - 1];
		const blockHash = this.hashBlock(prevBlock['hash'], { transactions: currentBlock['transactions'], index: currentBlock['index'] }, currentBlock['nonce']);
		if (blockHash.substring(0,4)!== '0000') validChain = false;
		if (currentBlock['previousBlockHash'] !== prevBlock['hash']) validChain = false;


		console.log('previousBlockHash =>' , prevBlock['hash']);
		console.log('currentBlockHash =>', currentBlock['hash']);
	};

	const genesisBlock = blockchain[0];
	const correctNonce = genesisBlock['nonce'] === 100;
	const correctPreviousBlockHash = genesisBlock['previousBlockHash'] === '0';
	const correctHash = genesisBlock['hash'] === '0';
	const correctTransactions = genesisBlock['transactions'].length === 0;

	if (!correctNonce || !correctPreviousBlockHash || !correctHash || !correctTransactions) validChain = false;

	return validChain;
};



Blockchain.prototype.getBlock = function(blockHash) {
	let correctBlock = null;
	this.chain.forEach(block  => {
		if(block.hash === blockHash) correctBlock = block;
	});
	return correctBlock;
};


Blockchain.prototype.getTransaction = function(ChainId) {
	let correctTransaction = null;
	let correctBlock = null;

	this.chain.forEach(block => {
		block.transactions.forEach(transaction => {
			if(transaction.ChainId === ChainId) {
				correctTransaction = transaction;
				correctBlock = block;
			};
		});
	});

	return {
		transaction: correctTransaction,
		block: correctBlock
	};
};


Blockchain.prototype.getAddressData = function(address) {
	const addressTransaction = [];
	this.chain.forEach(block => {
		block.transactions.forEach(transaction => {
			if(transaction.Manufacturer === address || transaction.Component === address || transaction.Destination === address || transaction.Material === address || transaction.From === address || transaction.status === address || transaction.Station === address || transaction.Process === address || transaction.Role === address || transaction.Category === address) {
				addressTransaction.push(transaction);
			};
		});
	});

	

	return{
		addressTransaction: addressTransaction,
		
	};
};




module.exports = Blockchain;