// Copyright (c) 2020, The TurtleCoin Developers
//
// Please see the included LICENSE file for more information.

import { NetworkController } from './NetworkController';
import { PeerList } from './PeerList';
import { LevinPayloads } from 'turtlecoin-utils';
import { Metronome } from 'node-metronome';
import { Interfaces } from './Types';

/**
 * @ignore
 */
import IPeer = Interfaces.IPeer;

/**
 * @ignore
 */
import PeerEntry = LevinPayloads.PeerEntry;

/**
 * Peer-to-Peer class that allows us to connect to the TurtleCoin network directly
 */
export class P2P extends NetworkController {
    private readonly m_defaultConnectionsCount: number;
    private readonly m_seedNodes: IPeer[] = [
        { ip: '206.189.142.142', port: 11897 },
        { ip: '145.239.88.119', port: 11999 },
        { ip: '142.44.242.106', port: 11897 },
        { ip: '165.227.252.132', port: 11897 },
        { ip: '148.251.178.238', port: 11897 },
        { ip: '45.32.138.7', port: 11897 },
        { ip: '46.214.70.196', port: 11897 },
        { ip: '94.113.119.122', port: 11897 }
    ];

    private readonly m_peerlist: PeerList = new PeerList();
    private readonly m_connectionTimer: Metronome = new Metronome(15000);

    /**
     * Constructs a new instance of a P2P class
     * @param ip the local ip address to bind to
     * @param port the local port to bind to
     * @param externalPort the external port to advertise to peers
     * @param defaultConnectionsCount the number of peers we should try to remain connected to
     * @param seedNodes an array of seed nodes to override the inbuilt seed nodes
     */
    constructor (
        ip = '0.0.0.0',
        port = 11897,
        externalPort?: number,
        defaultConnectionsCount = 8,
        seedNodes?: IPeer[]
    ) {
        super(ip, port, externalPort);

        this.m_defaultConnectionsCount = defaultConnectionsCount;

        if (seedNodes) {
            this.m_seedNodes = seedNodes;
        }

        this.m_connectionTimer.on('tick', async () => {
            this.m_connectionTimer.paused = true;
            while (this.outgoing.length < this.defaultConnectionsCount &&
                this.m_peerlist.candidatePeers.length > 0) {
                const peer = this.m_peerlist.randomPeer();

                if (!peer) {
                    break;
                }

                try {
                    await this.connect(peer);
                } catch (error) {
                    if (peer.id) {
                        this.m_peerlist.greyListPeer(peer.id);
                    }
                }
            }
            this.m_connectionTimer.paused = false;
        });

        this.on('handshake', (id, payload) => {
            this.m_peerlist.importPeers(payload.local_peerlist);
        });

        this.on('timed_sync', (id, payload) => {
            this.m_peerlist.importPeers(payload.local_peerlist);
        });
    }

    /**
     * Returns the list of candidate peers we have discovered
     */
    public get peers (): PeerEntry[] {
        return this.m_peerlist.candidatePeers;
    }

    /**
     * Returns the list of greylisted peers
     */
    public get grey_peers (): PeerEntry[] {
        return this.m_peerlist.greyPeers;
    }

    /**
     * The number of peers we should remain connected to
     */
    public get defaultConnectionsCount (): number {
        return this.m_defaultConnectionsCount;
    }

    /**
     * The seed nodes we were initialized with
     */
    public get seedNodes (): IPeer[] {
        return this.m_seedNodes;
    }

    /**
     * Start up the P2P instance
     */
    public async start (): Promise<void> {
        await this.m_peerlist.load();

        await Promise.all(
            this.seedNodes
                .map(seed => this.connect(seed)));

        if (this.outgoing.length === 0) {
            throw new Error('Could not connect to any seed nodes');
        }

        this.m_connectionTimer.paused = false;
        this.m_connectionTimer.tick();
    }

    /**
     * Shutdown the P2P instance
     */
    public async shutdown () {
        this.m_connectionTimer.destroy();
        await super.shutdown();
    }
}
