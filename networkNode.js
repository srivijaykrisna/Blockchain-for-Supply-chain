const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const Blockchain = require('./blockchain');
const uuid = require('uuid/v1');
const port = process.argv[2];
const rp = require('request-promise');

const nodeAddress = uuid().split('-').join('');

const supply_chain = new Blockchain();


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false}));



app.get('/blockchain',function(req, res) {
	res.send(supply_chain);	
});


app.post('/transaction', function(req, res) {
	const newTransaction = req.body;
	const blockIndex = supply_chain.addTransactionTopendingChain(newTransaction);
	res.json({ note: `Transaction will be added in block ${blockIndex}.`});
});



app.post('/transaction/broadcast',function(req, res) {
	const newTransaction = supply_chain.createNewTransaction(req.body.Station, req.body.Manufacturer_Name, req.body.Process, req.body.Role, req.body.Component, req.body.Material, req.body.Category, req.body.Quantity, req.body.From, req.body.Destination, req.body.status, req.body.amount);
	supply_chain.addTransactionTopendingChain(newTransaction);

	const requestPromises = [];
	supply_chain.networkNode.forEach(networkNodeUrl => {
		const requestOptions = {
			uri: networkNodeUrl + '/transaction',
			method: 'POST',
			body: newTransaction,
			json: true
		};

		requestPromises.push(rp(requestOptions));
	});

	Promise.all(requestPromises)
	.then(data => {
		res.json({ note: 'Transaction created and broadcast successfully.'});
	});
});





app.get('/mine', function(req, res) {
	const lastBlock = supply_chain.getLastBlock();
	const previousBlockHash = lastBlock['hash'];
	const currentBlockData = {
		transactions : supply_chain.pendingChain,
		index: lastBlock['index']+1
	};
	const nonce = supply_chain.proofOfWork(previousBlockHash, currentBlockData);
	const blockHash = supply_chain.hashBlock(previousBlockHash, currentBlockData, nonce);

	

	const newBlock = supply_chain.createNewBlock(nonce, previousBlockHash, blockHash);
	

	const requestPromises = [];
	supply_chain.networkNode.forEach(networkNodeUrl => {
		const requestOptions = {
			uri: networkNodeUrl + '/receive-new-block',
			method:'POST',
			body: {newBlock: newBlock},
			json: true
		};
		requestPromises.push(rp(requestOptions));
	});

	Promise.all(requestPromises)
	.then(data => {
		res.json({
			note: "New block mined & broadcast successfully",
			block : newBlock

		});

	
	});


});

app.post('/receive-new-block', function(req, res) {
	const newBlock = req.body.newBlock;
	const lastBlock = supply_chain.getLastBlock();
	const correctHash = lastBlock.hash === newBlock.previousBlockHash;
	const correctIndex = lastBlock['index']+1 === newBlock['index'];


	if (correctHash && correctIndex) {
		supply_chain.chain.push(newBlock);
		supply_chain.pendingChain = [];

		res.json({
			note: ' New block received and accepted sucessfully',
			newBlock: newBlock

		});
	} else{
		res.json({
			note:'New block rejected',
			newBlock: newBlock
		});
	}
});


app.post('/register-and-broadcast-node', function(req, res) {
	const newNodeUrl = req.body.newNodeUrl;
	if (supply_chain.networkNode.indexOf(newNodeUrl) == -1) supply_chain.networkNode.push(newNodeUrl);

	const regNodesPromises = [];
	supply_chain.networkNode.forEach(networkNodeUrl => {
		const requestOptions = {
			uri: networkNodeUrl +'/register-node',
			method: 'POST',
			body: { newNodeUrl: newNodeUrl },
			json: true
		};

		regNodesPromises.push(rp(requestOptions));

	});
	Promise.all(regNodesPromises)
	.then(data =>  {
		const bulkRegisterOptions = {
			uri: newNodeUrl + '/register-nodes-bulk',
			method: 'POST',
			body: { allNetworkNode: [...supply_chain.networkNode, supply_chain.currentNodeUrl ] },
			json: true 
		};

		return rp(bulkRegisterOptions);


	})
	.then(data => {
		res.json({note: 'New node registered with network sucessfully'});

	});
});




app.post('/register-node', function(req, res) {
	
	const newNodeUrl = req.body.newNodeUrl;
	
	const nodeNotAlreadyPresent = supply_chain.networkNode.indexOf(newNodeUrl) == -1;
	const notCurrentNode = supply_chain.currentNodeUrl !== newNodeUrl;
	if (nodeNotAlreadyPresent && notCurrentNode ) supply_chain.networkNode.push(newNodeUrl);
	res.json({ note: 'New node registered successfully.' });
});


app.post('/register-nodes-bulk', function(req, res) {
	const allNetworkNode = req.body.allNetworkNode;
	allNetworkNode.forEach(networkNodeUrl => {
		const nodeNotAlreadyPresent = supply_chain.networkNode.indexOf(networkNodeUrl) == -1;
		const notCurrentNode = supply_chain.currentNodeUrl !== networkNodeUrl;
		if (nodeNotAlreadyPresent && notCurrentNode) supply_chain.networkNode.push(networkNodeUrl);
	});

	res.json ({note : 'Bulk registration successful.'});
});


app.get('/consensus', function(req, res) {
	const requestPromises = [];
	supply_chain.networkNode.forEach(networkNodeUrl => {
		const requestOptions = {
			uri: networkNodeUrl + '/blockchain',
			method: 'GET',
			json: true
		};

		requestPromises.push(rp(requestOptions));
	});

	Promise.all(requestPromises)
	.then(blockchains => {
		const currentChainLength = supply_chain.chain.length;
		let maxChainLength = currentChainLength;
		let newLongestChain = null;
		let newpendingChain = blockchains.pendingChain;


		blockchains.forEach(blockchain => {
			if(blockchain.chain.length > maxChainLength) {
				maxChainLength = supply_chain.chain.length;
				newLongestChain = blockchain.chain;
				newpendingChain = blockchain.pendingChain;
			};
		});

		if(!newLongestChain || (newLongestChain && !supply_chain.chainIsValid(newLongestChain))) {
			res.json({
				note: 'Current Chain has not been replaced.' ,
				chain: supply_chain.chain
			});
		}

		else {
			supply_chain.chain = newLongestChain;
			supply_chain.pendingChain = newpendingChain;
			res.json({
				note: 'This chain has been replaced.',
				chain: supply_chain.chain
			});
		}

	});
});


app.get('/block/:blockHash', function(req, res) {  
	const blockHash = req.params.blockHash;
	const correctBlock = supply_chain.getBlock(blockHash);
	res.json({
		block: correctBlock
	});
});

app.get('/transaction/:ChainId', function(req, res) {
	const ChainId = req.params.ChainId;
	const transactionData = supply_chain.getTransaction(ChainId);
	res.json({
		transaction: transactionData.transaction,
		block: transactionData.block
	});
});

app.get('/address/:address', function(req, res) {
	const address = req.params.address;
	const addressData = supply_chain.getAddressData(address);
	res.json({
		addressData: addressData
	});

});


app.get('/block-explorer', function(req, res) {
	res.sendFile('./block-explorer/index.html', { root: __dirname});
});


app.listen(port, function() {
	console.log(`listening on port ${port}...`);
});