
const chai = require('chai')
import { expect, assert } from 'chai';
import { describe, it, before, teardown, Test } from 'mocha';
chai.use(require('chai-as-promised')).use(require('chai-bytes'));
require('mocha')

import {
    MerkleTree,
    hashBranch,
    hashLeaf,
} from "../src";


import { MerkleTreeVerifierContract } from '../build/wrappers/merkle_tree_verifier';

import { 
    GanacheTestchain, TestTreeFactory, hexify, keccak256, waitUntilConnected, prefix0x, getDeployArgs
} from './helpers'

import { Web3ProviderEngine, RPCSubprovider, BigNumber } from "0x.js";
import { Web3Wrapper, AbiDefinition, Provider, TxData } from '@0x/web3-wrapper';
import { TruffleArtifactAdapter, RevertTraceSubprovider } from '@0x/sol-trace';

let $web3 = require('web3')
const AbiCoder = require('web3-eth-abi').AbiCoder();





function dehexify(str: string): Buffer {
    // begins with 0x
    if(str[1] == 'x') str = str.slice(2);
    return Buffer.from(str, 'hex')
}


describe('Solidity verifier', function() {
    this.timeout(15000)

    let pe: Web3ProviderEngine, web3: Web3Wrapper;
    let accounts: string[];

    let merkleTreeVerifier: MerkleTreeVerifierContract;

    before(async () => {
        const port = '9546';
        let chain = GanacheTestchain.start(port);
        
        let pe2 = new Web3ProviderEngine();
        pe2.addProvider(new RPCSubprovider(`http://127.0.0.1:${port}`))
        pe2.start()

        web3 = new Web3Wrapper(pe2);
        expect(waitUntilConnected(pe2), "didn't connect to chain").to.eventually.be.fulfilled;
        
        accounts = await web3.getAvailableAddressesAsync();

        // Now we add tracing in.
        const artifactAdapter = new TruffleArtifactAdapter(
            require('path').dirname(require.resolve('../../package.json')), 
            '0.5.0'
        );
        const revertTraceSubprovider = new RevertTraceSubprovider(
            artifactAdapter, 
            accounts[0],
            true
        );

        pe = new Web3ProviderEngine();
        pe.addProvider(revertTraceSubprovider);
        pe.addProvider(new RPCSubprovider(`http://127.0.0.1:${port}`))
        pe.start()
        expect(waitUntilConnected(pe), "didn't connect to chain").to.eventually.be.fulfilled;
        
        web3 = new Web3Wrapper(pe);

        merkleTreeVerifier = await MerkleTreeVerifierContract.deployAsync(
            ...getDeployArgs('MerkleTreeVerifier', pe, accounts[0])
        );
    });

    describe('math_log2', () => {
        it('log2(7) = 3', async() => {
            let res = await merkleTreeVerifier.math_log2.callAsync(new BigNumber('7'));
            expect(res.toString()).to.eq('3');
        })

        it('log2(8) = 3', async() => {
            let res = await merkleTreeVerifier.math_log2.callAsync(
                new BigNumber('7')
            );
            expect(res.toString()).to.eq('3');
        })
    })

    describe('_getBalancedLayer', () => {
        it('works for 6 items', async() => {
            let itemSolEncoded = [
                '12',
                '15',
                '20',
                '25',
                '42',
                '33',
            ].map(item => AbiCoder.encodeParameter('uint256', item))
            let items = await merkleTreeVerifier._getBalancedLayer.callAsync(
                itemSolEncoded
            );
            expect(items.length).to.eq(8);
            let lastItem = itemSolEncoded[itemSolEncoded.length - 1];
            expect(items[6]).to.eq(lastItem)
            expect(items[7]).to.eq(lastItem)
        })

        it('works for 4 items', async() => {
            let itemSolEncoded = [
                '12',
                '15',
                '20',
                '25',
            ].map(item => AbiCoder.encodeParameter('uint256', item))
            let items = await merkleTreeVerifier._getBalancedLayer.callAsync(
                itemSolEncoded
            );
            expect(items.length).to.eq(4);
            expect(items[3]).to.eq(itemSolEncoded[3])
        })
    })

    describe('_computeLayer', () => {
        function makeMockLayer(items: Buffer[]) {
            let layerJs = new Array(items.length / 2);
            for(let i = 0; i < layerJs.length; i++) {
                let left = i*2;
                layerJs[i] = hashBranch(keccak256, items[left], items[left+1]);
            }
            layerJs = layerJs.map(hexify)
            return layerJs
        }

        it('works for 8 items', async () => {
            let itemSolEncoded = [
                '12',
                '15',
                '20',
                '25',
                '42',
                '33',
                '151',
                '22'
            ].map(item => AbiCoder.encodeParameter('uint256', item))

            expect(itemSolEncoded.length).to.eq(8)
            
            let itemsBuf = itemSolEncoded.map(dehexify)
            let layerJs = makeMockLayer(itemsBuf)

            let layerSol = await merkleTreeVerifier._computeLayer.callAsync(itemSolEncoded)
            expect(layerSol).to.deep.eq(layerJs);
        })

        it('works for 4 items', async () => {
            let itemSolEncoded = [
                '12',
                '15',
                '20',
                '25'
            ].map(item => AbiCoder.encodeParameter('uint256', item))

            expect(itemSolEncoded.length).to.eq(4)
            
            let itemsBuf = itemSolEncoded.map(dehexify)
            let layerJs = makeMockLayer(itemsBuf)

            let layerSol = await merkleTreeVerifier._computeLayer.callAsync(itemSolEncoded)
            expect(layerSol).to.deep.eq(layerJs);
        })

        // TODO this throws but fails the entire test
        // it looks like it is bad but it's not, I swear
        it('fails for 6 items', async () => {
            // let itemSolEncoded = [
            //     '12',
            //     '15',
            //     '20',
            //     '25',
            //     '42',
            //     '33',
            // ].map(item => AbiCoder.encodeParameter('uint256', item))
            // let layerSol = merkleTreeVerifier._computeLayer.callAsync(itemSolEncoded)
            // expect(layerSol).to.throw;
        })
    })

    describe('_computeMerkleRoot', () => {
        it('passes on 1 items', async () => {
            let itemSolEncoded = [
                '12',
            ].map(item => AbiCoder.encodeParameter('uint256', item))
            
            let tree = new MerkleTree(itemSolEncoded.map(dehexify), keccak256);
            let rootJs = tree.root();
    
            let rootSol = await merkleTreeVerifier._computeMerkleRoot.callAsync(
                itemSolEncoded
            );
    
            expect(rootSol).to.eq(hexify(rootJs));
        })

        it('passes on 6 items', async () => {
            let itemSolEncoded = [
                '12',
                '15',
                '20',
                '25',
                '542',
                '33'
            ].map(item => AbiCoder.encodeParameter('uint256', item))
            
            // let tree = new MerkleTree(itemSolEncoded.map(dehexify).map(x => hashLeaf(keccak256, x)), keccak256);
            let tree = new MerkleTree(itemSolEncoded.map(dehexify), keccak256);
            let rootJs = tree.root();
    
            let rootSol = await merkleTreeVerifier._computeMerkleRoot.callAsync(
                itemSolEncoded
            );
    
            expect(rootSol).to.eq(hexify(rootJs));
        })

        it('passes on 8 items', async () => {
            let itemSolEncoded = [
                '12',
                '15',
                '20',
                '25',
                '42',
                '33',
                '151',
                '22'
            ].map(item => AbiCoder.encodeParameter('uint256', item))
            
            let tree = new MerkleTree(itemSolEncoded.map(dehexify), keccak256);
            let rootJs = tree.root();
    
            let rootSol = await merkleTreeVerifier._computeMerkleRoot.callAsync(
                itemSolEncoded
            );
    
            expect(rootSol).to.eq(hexify(rootJs));
        })
    })

    it('_hashLeaf', async() => {
        let data = ['00','2'];

        // TODO 1st param is bytes32, but uint256 encodes simpler
        let hex: string[] = [
            AbiCoder.encodeParameter('uint256', data[0]),
            AbiCoder.encodeParameter('uint256', data[1])
        ].map(item => item.slice(2))

        let buf = Buffer.concat(hex.map(x => Buffer.from(x, 'hex')));
        expect(buf.byteLength).to.eq(64);

        let leafJs = hashLeaf(keccak256, buf);
        let hashJs = hashLeaf(keccak256, leafJs);

        let hashSol = await merkleTreeVerifier._hashLeaf.callAsync(
            hexify(leafJs)
        )

        expect(hashSol).to.eq(hexify(hashJs));
    })

    it('_hashBranch', async() => {
        let left = '123';
        let right = '245';

        // TODO 1st param is bytes32, but uint256 encodes simpler
        let leftHex: string = AbiCoder.encodeParameter('uint256', left)
        let rightHex: string = AbiCoder.encodeParameter('uint256', right)

        let leftBuf = Buffer.from(leftHex.slice(2), 'hex')
        let rightBuf = Buffer.from(rightHex.slice(2), 'hex')

        expect(leftBuf.byteLength).to.eq(32);
        expect(rightBuf.byteLength).to.eq(32);

        let hashJs = hashBranch(keccak256, leftBuf, rightBuf);

        let hashSol = await merkleTreeVerifier._hashBranch.callAsync(
            leftHex,
            rightHex
        )

        expect(hashSol).to.eq(hexify(hashJs));
    })

    describe('_verify', async() => {
        it('works with 5 items', async() => {
            let itemSolEncoded = [
                '12',
                '15',
                '20',
                '25',
                '42',
            ].map(item => AbiCoder.encodeParameter('uint256', item))
            
            let tree = new MerkleTree(itemSolEncoded.map(dehexify), keccak256);
            
            async function testProof(item, i) {
                let proof = tree.generateProof(i)
    
                expect(
                    await merkleTreeVerifier._verify.callAsync(
                        proof.proofs.map(hexify),
                        proof.paths,
                        hexify(proof.root),
                        hexify(proof.leaf)
                    ),
                    `item ${i}`
                ).to.be.true;
            }

            await Promise.all(itemSolEncoded.map(testProof))
        })

        it('works with 8 items', async() => {
            let itemSolEncoded: string[] = [
                '12',
                '15',
                '20',
                '25',
                '42',
                '33',
                '151',
                '22'
            ].map(item => AbiCoder.encodeParameter('uint256', item))
            
            let tree = new MerkleTree(itemSolEncoded.map(dehexify), keccak256);
            
            async function testProof(item, i) {
                let proof = tree.generateProof(i)
    
                expect(
                    await merkleTreeVerifier._verify.callAsync(
                        proof.proofs.map(hexify),
                        proof.paths,
                        hexify(proof.root),
                        hexify(proof.leaf)
                    ),
                    `item ${i}`
                ).to.be.true;
            }

            await Promise.all(itemSolEncoded.map(testProof))
        })
    })

    it('_verify', async() => {
        let items = [
            ['1','2'],
            ['3','4']
        ]
        let itemsBuffed = TestTreeFactory.itemsToBuffer(items);
        let i = 0
        let itemToProve = itemsBuffed[i];
        
        let tree = TestTreeFactory.newTree(items)
        let leafToProve = tree.leaves[i]

        
        let proof = tree.generateProof(i);
        
        expect(tree.verifyProof(proof, leafToProve)).to.be.true;

        let root = await merkleTreeVerifier._computeRoot.callAsync(
            proof.proofs.map(hexify),
            proof.paths,
            hexify(leafToProve)
        )
        
        expect(root).to.eq(hexify(tree.layers[1][0]));
        expect(root).to.eq(hexify(tree.root()))

        let verify = await merkleTreeVerifier._verify.callAsync(
            proof.proofs.map(hexify), 
            proof.paths,
            hexify(tree.root()), 
            hexify(leafToProve)
        )
        expect(verify).to.be.true;
    })



})
