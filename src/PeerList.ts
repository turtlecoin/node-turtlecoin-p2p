// Copyright (c) 2020, The TurtleCoin Developers
//
// Please see the included LICENSE file for more information.

import { LevinPayloads } from 'turtlecoin-utils';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { Metronome } from 'node-metronome';
import { Interfaces } from './Types';

/**
 * @ignore
 */
import IPeerList = Interfaces.IPeerList;

/**
 * @ignore
 */
import PeerEntry = LevinPayloads.PeerEntry;

/**
 * @ignore
 */
const tmpPath = path.resolve(path.join(process.cwd(), '/tmp'));
/**
 * @ignore
 */
const stateFile = path.resolve(path.join(tmpPath, '/peerstate.json'));

export class PeerList extends EventEmitter {
    private m_peers: PeerEntry[] = [];
    private m_greyPeers: PeerEntry[] = [];
    private readonly m_timer: Metronome = new Metronome(10000);

    constructor () {
        super();

        this.m_timer.on('tick', async () => {
            try {
                await this.save();
            } catch {
                this.emit('warn', 'Could not save peer state');
            }
        });

        this.m_timer.paused = false;
    }

    public get candidatePeers (): PeerEntry[] {
        return this.m_peers;
    }

    public get greyPeers (): PeerEntry[] {
        return this.m_greyPeers;
    }

    public importPeers (peers: PeerEntry[]) {
        for (const peer of peers) {
            if (!peer || !peer.id) {
                continue;
            }

            if (!this.getPeer(peer.id) && !this.isGreyPeer(peer.id)) {
                this.m_peers.push(peer);
            }
        }
    }

    public getPeer (id: string): PeerEntry | undefined {
        for (const peer of this.m_peers) {
            if (peer.id === id) {
                return peer;
            }
        }
    }

    public isGreyPeer (id: string): boolean {
        for (const peer of this.m_greyPeers) {
            if (peer.id === id) {
                return true;
            }
        }
        return false;
    }

    public randomPeer (): PeerEntry {
        return random(this.candidatePeers);
    }

    public greyListPeer (id: string) {
        const peer = this.getPeer(id);
        if (!peer) {
            return;
        }

        this.m_peers = this.m_peers.filter((value) => {
            return value.id !== id;
        });

        this.m_greyPeers.push(peer);
    }

    public async load (): Promise<void> {
        try {
            await this._load();
        } catch {
            this.emit('warn', 'Could not load peer state');
        }
    }

    private async _load (): Promise<void> {
        if (!fs.existsSync(stateFile)) {
            return;
        }

        const json = fs.readFileSync(stateFile)
            .toString();

        const peerList: IPeerList = JSON.parse(json);

        peerList.peers.map((value) => this.m_peers.push(PeerEntry.from(value)));
        peerList.grey_peers.map((value) => this.m_greyPeers.push(PeerEntry.from(value)));
    }

    private export (): string {
        const peers: string[] = [];
        const grey_peers: string[] = [];

        this.candidatePeers.map((value) => peers.push(value.toString()));
        this.greyPeers.map((value) => grey_peers.push(value.toString()));

        return JSON.stringify({ peers, grey_peers });
    }

    private async save (): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(tmpPath)) {
                fs.mkdirSync(tmpPath);
            }

            fs.writeFile(stateFile, this.export(), (error) => {
                if (error) {
                    return reject(error);
                }

                return resolve();
            });
        });
    }
}

/** @ignore */
function random (arr: any[]): any {
    const index = Math.round(Math.random() * arr.length);
    return arr[index];
}
