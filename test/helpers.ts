import { MerkleTree } from "../src";
const AbiCoder = require('web3-eth-abi').AbiCoder();

// @ts-ignore
import { keccak256 } from 'ethereumjs-util';
import { Web3ProviderEngine } from "0x.js";
import { AbiDefinition, Provider, TxData } from '@0x/web3-wrapper';

function getDeployArgs(name: string, pe: Provider, from: string): [ string, AbiDefinition[], Provider, Partial<TxData>] {
    let json = require(`../../build/artifacts/${name}.json`);
    let bytecode = json.compilerOutput.evm.bytecode.object;
    let abi = json.compilerOutput.abi;
    let provider = pe;
    console.log(from)

    return [
        bytecode,
        abi,
        provider,
        { from }
    ]
}

class TestTreeFactory {
    static itemsToBuffer(items: string[][]): Buffer[] {
        let itemsBuf: Buffer[] = [
            ...items.map(item => AbiCoder.encodeParameter('uint256', item))
        ].map(item => item.slice(2)).map(item => Buffer.from(item, 'hex'))
        return itemsBuf;
    }

    static newTree(items: string[][]): MerkleTree {
        let tree = new MerkleTree(
            this.itemsToBuffer(items),
            keccak256
        );
        return tree;
    }
}

function hexify(buf: Buffer): string {
    return `0x${buf.toString('hex')}`;
}

function prefix0x(x: string): string {
    return `0x${x}`;
}


const ganache = require("ganache-core");

class GanacheTestchain {
    static async start(port: string) {
        const server = ganache.server({ 
            ws: true,
            logger: {
                log: () => false // console.log
            },
            total_accounts: 100,
            s: "TestRPC is awesome!", // I didn't choose this
            gasPrice: 0,
            networkId: 420,
            debug: false,
            defaultBalanceEther: '100000000000000000000000000000',
            unlock: [0, 1],
        });

        let blockchainState = await new Promise<any>((res, rej) => {
            server.listen(port, (err, state) => {
                if(err) rej(err);
                else res(state)
            })
        });
        
        return blockchainState;
    }
}

function waitUntilConnected(pe: Web3ProviderEngine): Promise<any> {
    return new Promise((res, rej) => {
        pe.on('block', res)
        setTimeout(rej, 2000)
    });
}

export {
    getDeployArgs,
    TestTreeFactory,
    GanacheTestchain,
    hexify,
    prefix0x,
    keccak256,
    waitUntilConnected
}