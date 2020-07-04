// Copyright (c) 2020, The TurtleCoin Developers
//
// Please see the included LICENSE file for more information.

import { Socket } from './Socket';
import { EventEmitter } from 'events';
import { Server, createServer, AddressInfo } from 'net';

/**
 * Represents a helper in managing inbound connections
 */
export class NetworkServer extends EventEmitter {
    private readonly m_server: Server;
    private readonly m_ip: string;
    private readonly m_port: number;

    /**
     * Creates a new instance of a network server
     * @param ip the local ip address to bind to
     * @param port the local port to bind to
     * @param exclusive whether we will use this port exclusively
     */
    constructor (
        ip = '0.0.0.0',
        port = 11897,
        exclusive = true
    ) {
        super();

        this.m_ip = ip;

        this.m_port = port;

        this.m_server = createServer({ pauseOnConnect: true });

        this.m_server.on('connection', socket =>
            this.emit('connection', new Socket(socket)));

        this.m_server.on('close', () => this.emit('close'));
        this.m_server.on('error', error => this.emit('error', error));
        this.m_server.on('listening', () => this.emit('listening'));

        this.m_server.listen({
            host: ip,
            port,
            exclusive
        });
    }

    /**
     * Our locally bound ip
     */
    public get ip (): string {
        return this.m_ip;
    }

    /**
     * Our locally bound port
     */
    public get port (): number {
        return this.m_port;
    }

    /**
     * The underlying local socket information
     */
    public get address (): AddressInfo | string | null {
        return this.m_server.address();
    }

    /**
     * Closes the server to further listening
     */
    public async close (): Promise<void> {
        return new Promise(resolve =>
            this.m_server.close((err) => {
                if (err) {
                    this.emit('error', err);
                }

                return resolve();
            }));
    }

    /**
     * Retrieves the number of active connections to the server
     */
    public async connections (): Promise<number> {
        return new Promise((resolve, reject) =>
            this.m_server.getConnections((error, count) => {
                if (error) {
                    return reject(error);
                }

                return resolve(count);
            }));
    }

    /**
     * Whether the server is currently listening
     */
    public get listening (): boolean {
        return this.m_server.listening;
    }

    /**
     * The maximum number of connections permitted to the server
     */
    public get maxConnections (): number {
        return this.m_server.maxConnections;
    }

    public set maxConnections (count: number) {
        this.m_server.maxConnections = count;
    }
}
