// Copyright (c) 2020, The TurtleCoin Developers
//
// Please see the included LICENSE file for more information.

import { NetworkClient } from './NetworkClient';
import { NetworkServer } from './NetworkServer';
import { Socket } from './Socket';
import { LevinPacket, LevinPayloads, LevinProtocol } from 'turtlecoin-utils';
import { EventEmitter } from 'events';
import { Interfaces } from './Types';
import * as UUID from 'uuid';

/**
 * @ignore
 */
import LevinCommands = LevinProtocol.CommandType;

/**
 * @ignore
 */
import ILevinPayload = LevinPayloads.ILevinPayload;

/**
 * @ignore
 */
import IPeer = Interfaces.IPeer;

/**
 * Controls our connections to the p2p network
 */
export class NetworkController extends EventEmitter {
    private m_networkId = 'b50c4a6ccf52574165f991a4b6c143e9';
    private m_version = 11;
    private m_id: string = UUID.v4()
        .toString()
        .replace(/[-l1io0]/gi, '')
        .substring(0, 16)
        .toLowerCase();

    private m_outgoing: NetworkClient[] = [];
    private m_incoming: NetworkClient[] = [];
    private m_server: NetworkServer;
    private m_externalPort?: number;
    private readonly m_port: number;

    /**
     * Creates a new instance of a network controller
     * @param ip our local ip address to bind to
     * @param port the local port to bind to
     * @param externalPort the external port to advertise to peers
     * @param maxIncomingConnections the maximum number of event listeners to permit
     */
    constructor (
        ip = '0.0.0.0',
        port = 11897,
        externalPort?: number,
        maxIncomingConnections?: number
    ) {
        super();

        this.m_port = port;

        if (externalPort) {
            this.m_externalPort = externalPort;
        }

        this.m_server = new NetworkServer(ip, port);

        this.m_server.on('close', () =>
            this.emit('close')
        );

        this.m_server.on('error', (error) =>
            this.emit('error', error)
        );

        this.m_server.on('listening', () =>
            this.emit('listening')
        );

        this.m_server.on('connection', (socket) =>
            this.connectSocket(socket)
        );

        if (maxIncomingConnections) {
            this.m_server.maxConnections = maxIncomingConnections;
        }
    }

    /**
     * The outgoing network clients
     */
    public get outgoing (): NetworkClient[] {
        return this.m_outgoing;
    }

    /**
     * The incoming network clients
     */
    public get incoming (): NetworkClient[] {
        return this.m_incoming;
    }

    /**
     * The network ID
     */
    public get networkId (): string {
        return this.m_networkId;
    }

    /**
     * The version of the p2p network
     */
    public get version (): number {
        return this.m_version;
    }

    /**
     * Our peer id
     */
    public get id (): string {
        return this.m_id;
    }

    /**
     * Our local IP address
     */
    public get ip (): string {
        return this.m_server.ip;
    }

    /**
     * Our local port
     */
    public get port (): number {
        return this.m_server.port;
    }

    /**
     * The number of active connections
     */
    public get connections (): number {
        return this.outgoing.length + this.incoming.length;
    }

    /**
     * The number of maximum incoming connections
     */
    public get maxIncomingConnections (): number {
        return this.m_server.maxConnections;
    }

    /**
     * The external port we advertise
     */
    public get externalPort (): number | undefined {
        return this.m_externalPort;
    }

    public set externalPort (externalPort: number | undefined) {
        this.m_externalPort = externalPort;
    }

    public on(
        event: 'clientError', listener: (id: string, error: Error) => void): this;

    public on(
        event: 'close', listener: () => void): this;

    public on(
        event: 'connect', listener: (id: string, ip: string, port: number) => void): this;

    public on(
        event: 'disconnect', listener: (id: string, error?: Error) => void): this;

    public on(
        event: 'error', listener: (error: Error) => void): this;

    public on(
        event: 'send', listener: (id: string, buffer: Buffer) => void): this;

    public on(
        event: 'handshake', listener: (id: string, payload: LevinPayloads.Handshake) => void): this;

    public on(
        event: 'listening', listener: () => void): this;

    public on(
        event: 'timed_sync', listener: (id: string, payload: LevinPayloads.TimedSync) => void): this;

    public on(
        event: 'new_block', listener: (id: string, payload: LevinPayloads.NewBlock) => void): this;

    public on(
        event: 'new_transactions', listener: (id: string, payload: LevinPayloads.NewTransactions) => void): this;

    public on(
        event: 'request_get_objects', listener: (id: string, payload: LevinPayloads.RequestGetObjects) => void): this;

    public on(
        event: 'response_get_objects', listener: (id: string, payload: LevinPayloads.ResponseGetObjects) => void): this;

    public on(
        event: 'request_chain', listener: (id: string, payload: LevinPayloads.RequestChain) => void): this;

    public on(
        event: 'response_chain_entry', listener: (id: string, payload: LevinPayloads.ResponseChain) => void): this;

    public on(
        event: 'request_tx_pool', listener: (id: string, payload: LevinPayloads.RequestTXPool) => void): this;

    public on(
        event: 'lite_block', listener: (id: string, payload: LevinPayloads.LiteBlock) => void): this;

    public on(
        event: 'missing_transactions',
        listener: (id: string, payload: LevinPayloads.MissingTransactions) => void): this;

    public on(
        event: 'change_id',
        listener: (oldId: string, newId: string) => void): this;

    public on(event: 'unknown', listener: (id: string, payload: ILevinPayload) => void): this;

    public on(event: 'warn', listener: (error: Error) => void): this;

    public on (event: any, listener: (...args: any[]) => void): this {
        return super.on(event, listener);
    }

    /**
     * Attempts to connect to the given peer
     * @param peer
     */
    public async connect (
        peer: IPeer
    ): Promise<void> {
        const client = await NetworkClient.start(peer.ip, peer.port, peer.id);

        if (!client) {
            return;
        }

        client.once('close', (id: string, error) => {
            this.del(client);
            this.emit('disconnect', id, error);
        });

        client.on('packet', (id, packet) => {
            this.handlePacket(id, packet, false);
        });

        client.on('error', (id, error) => {
            this.emit('clientError', id, error);
        });

        this.m_outgoing.push(client);

        const handshake = new LevinPayloads.Handshake();
        handshake.network_id = this.networkId;
        handshake.version = this.version;
        handshake.local_time = new Date();
        handshake.my_port = this.externalPort || this.port;
        handshake.peer_id = this.id;

        await this.send(LevinCommands.HANDSHAKE, handshake, true, client.id);

        this.emit('connect', client.id, client.remoteAddress, client.remotePort);
    }

    /**
     * Shuts down the network controller
     */
    public async shutdown () {
        await this.m_server.close();

        const shutdowns = [];

        for (const client of this.outgoing) {
            shutdowns.push(client.destroy());
        }

        for (const client of this.incoming) {
            shutdowns.push(client.destroy());
        }

        await Promise.all(shutdowns);
    }

    /**
     * Sends a packet to the network
     * @param type the levin command type
     * @param payload the levin payload
     * @param responseExpected whether a response is expected
     * @param id the target id of the singular peer we want to send to
     */
    public async send (
        type: LevinProtocol.CommandType,
        payload: ILevinPayload,
        responseExpected = false,
        id?: string
    ): Promise<boolean> {
        let target;
        if (id) {
            target = this.get(id);
        }

        const packet = new LevinPacket(type);
        packet.return_data = responseExpected;
        packet.payload = payload;

        if (target) {
            return target.write(packet.toBuffer());
        } else {
            return Promise.all(this.m_outgoing
                .map(client => client.write(packet.toBuffer())
                    .catch(() => { return false; })))
                .then(results =>
                    results.reduce((acc: boolean, val: boolean) => acc && val));
        }
    }

    private async connectSocket (
        socket: Socket
    ) {
        const client = new NetworkClient(socket);

        client.once('close', (id: string, error: Error) => {
            this.del(client);
            this.emit('disconnect', id, error);
        });

        client.on('packet', (id, packet) => {
            this.handlePacket(id, packet, true);
        });

        client.resume();

        this.m_incoming.push(client);
    }

    private handlePacket (
        id: string,
        packet: LevinPacket,
        incoming = false
    ) {
        const ping = new LevinPayloads.Ping();
        ping.status = 'OK';

        switch (packet.command) {
        case LevinCommands.HANDSHAKE:
            id = this.setId(id, (packet.payload as LevinPayloads.Handshake).peer_id, incoming);
            return this.emit('handshake', id, packet.payload);
        case LevinCommands.TIMEDSYNC:
            return this.emit('timed_sync', id, packet.payload);
        case LevinCommands.PING:
            return this.send(LevinCommands.PING, ping, false, id).catch();
        case LevinCommands.NEW_BLOCK:
            return this.emit('new_block', id, packet.payload);
        case LevinCommands.NEW_TRANSACTIONS:
            return this.emit('new_transactions', id, packet.payload);
        case LevinCommands.REQUEST_GET_OBJECTS:
            return this.emit('request_get_objects', id, packet.payload);
        case LevinCommands.RESPONSE_GET_OBJECTS:
            return this.emit('response_get_objects', id, packet.payload);
        case LevinCommands.REQUEST_CHAIN:
            return this.emit('request_chain', id, packet.payload);
        case LevinCommands.RESPONSE_CHAIN_ENTRY:
            return this.emit('response_chain_entry', id, packet.payload);
        case LevinCommands.REQUEST_TX_POOL:
            return this.emit('request_tx_pool', id, packet.payload);
        case LevinCommands.LITE_BLOCK:
            return this.emit('lite_block', id, packet.payload);
        case LevinCommands.MISSING_TRANSACTIONS:
            return this.emit('missing_transactions', id, packet.payload);
        default:
            return this.emit('unknown', id, packet.payload);
        }
    }

    private setId (
        id: string,
        newId: string,
        incoming = false
    ): string {
        this.emit('change_id', id, newId);

        const idx = this.getIdx(id, incoming);

        if (incoming) {
            this.m_incoming[idx].id = newId;
        } else {
            this.m_outgoing[idx].id = newId;
        }

        return newId;
    }

    private del (
        client: NetworkClient
    ) {
        this.m_outgoing = this.m_outgoing.filter((value) => {
            return value.id !== client.id;
        });

        this.m_incoming = this.m_incoming.filter((value) => {
            return value.id !== client.id;
        });
    }

    private get (
        id: string
    ): NetworkClient | undefined {
        for (const client of this.outgoing) {
            if (client.id === id) {
                return client;
            }
        }

        for (const client of this.incoming) {
            if (client.id === id) {
                return client;
            }
        }
    }

    private getIdx (
        id: string,
        incoming = false
    ): number {
        if (!incoming) {
            for (let i = 0; i < this.outgoing.length; i++) {
                if (this.outgoing[i].id === id) {
                    return i;
                }
            }
        } else {
            for (let i = 0; i < this.incoming.length; i++) {
                if (this.incoming[i].id === id) {
                    return i;
                }
            }
        }

        return -1;
    }
}
