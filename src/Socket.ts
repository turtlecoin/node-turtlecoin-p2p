// Copyright (c) 2020, The TurtleCoin Developers
//
// Please see the included LICENSE file for more information.

import { Socket as NetworkSocket, AddressInfo } from 'net';
import { EventEmitter } from 'events';
import { LevinPacket } from 'turtlecoin-utils';
import { v4 } from 'uuid';

/**
 * Implements a wrapper to help with adding an "id" to help identify the socket
 */
export class Socket extends EventEmitter {
    private readonly m_socket: NetworkSocket;
    private m_id: string = v4()
        .toString()
        .replace(/[-l1io0]/gi, '')
        .substring(0, 16)
        .toLowerCase();

    private m_buffer: Buffer = Buffer.alloc(0);

    /**
     * Creates a new instance of our Socket object
     * @param socket the underlying socket to use
     * @param maxListeners the maximum number of event listeners to permit
     * @param id the peer id of the socket if available
     */
    constructor (
        socket: NetworkSocket | Socket,
        maxListeners = 10,
        id?: string
    ) {
        super();

        if (id) {
            this.m_id = id;
        }

        this.setMaxListeners(maxListeners);

        this.m_socket = (socket instanceof NetworkSocket) ? socket : socket.socket;

        this.m_socket.on('close', error => this.emit('close', this.id, error));
        this.m_socket.on('connect', () => this.emit('connect', this.id));
        this.m_socket.on('data', data => {
            if (typeof data === 'string') {
                data = Buffer.from(data);
            }

            this.emit('data', this.id, data);
        });
        this.m_socket.on('drain', () => this.emit('drain', this.id));
        this.m_socket.on('end', () => this.emit('close', this.id, false));
        this.m_socket.on('error', error => this.emit('error', this.id, error));
        this.m_socket.on('timeout', () => this.emit('timeout', this.id));

        this.on('data', (id, data) => {
            this.m_buffer = Buffer.concat([this.m_buffer, data]);

            let packet: LevinPacket = new LevinPacket();

            try {
                packet = LevinPacket.from(this.m_buffer);
                this.m_buffer = Buffer.alloc(0);
            } catch {
                try {
                    packet = LevinPacket.from(data);
                    this.m_buffer = Buffer.alloc(0);
                } catch (error) {
                    this.emit('debug', error);
                }
            }

            if (packet.command !== 0) {
                this.emit('packet', this.id, packet);
            }
        });
    }

    public on(event: 'close', listener: (id: string, errorOccurred: boolean) => void): this;

    public on(event: 'connect', listener: (id: string) => void): this;

    public on(event: 'data', listener: (id: string, data: Buffer) => void): this;

    public on(event: 'drain', listener: (id: string) => void): this;

    public on(event: 'error', listener: (id: string, error: Error) => void): this;

    public on(event: 'timeout', listener: (id: string) => void): this;

    public on(event: 'debug', listener: (id: string, error: Error) => void): this;

    public on(event: 'packet', listener: (id: string, packet: LevinPacket) => void): this;

    public on (event: any, listener: (...args: any[]) => void): this {
        return super.on(event, listener);
    }

    /**
     * Returns the underlying socket
     */
    public get socket (): NetworkSocket {
        return this.m_socket;
    }

    /**
     * The peer id
     */
    public get id (): string {
        return this.m_id;
    }

    public set id (id: string) {
        this.m_id = id;
    }

    /**
     * The remote address information
     */
    public get address (): AddressInfo | string {
        return this.m_socket.address();
    }

    /**
     * Whether the socket is currently in the process of connecting
     */
    public get connecting (): boolean {
        return this.m_socket.connecting;
    }

    /**
     * Destroys the socket
     */
    public destroy (): void {
        this.m_socket.destroy();
    }

    /**
     * Whether the socket has been destroyed
     */
    public get destroyed (): boolean {
        return this.m_socket.destroyed;
    }

    /**
     * The local address information of the socket
     */
    public get localAddress (): string {
        return this.m_socket.localAddress;
    }

    /**
     * The local port of the socket
     */
    public get localPort (): number {
        return this.m_socket.localPort;
    }

    /**
     * Pauses the reading of data from the socket
     */
    public pause (): void {
        this.m_socket.pause();
    }

    /**
     * The remote ip of the socket
     */
    public get remoteAddress (): string | undefined {
        return this.m_socket.remoteAddress;
    }

    /**
     * The remote IP version of the socket
     */
    public get remoteFamily (): string | undefined {
        return this.m_socket.remoteFamily;
    }

    /**
     * The report port of the socket
     */
    public get remotePort (): number | undefined {
        return this.m_socket.remotePort;
    }

    /**
     * Resumes the socket if it has been paused
     */
    public resume (): void {
        this.m_socket.resume();
    }

    public setKeepalive (value: boolean, initialDelay = 0): void {
        this.m_socket.setKeepAlive(value, initialDelay);
    }

    /**
     * Gracefully ends the socket
     */
    public async end (): Promise<void> {
        return new Promise(resolve => this.m_socket.end(() => resolve()));
    }

    /**
     * Sets the timeout of the socket
     * @param value
     */
    public async setTimeout (value: number): Promise<void> {
        return new Promise(resolve => this.m_socket.setTimeout(value, () => resolve()));
    }

    /**
     * Writes data to the socket
     * @param data the data to write to the socket
     * @param encoding the encoding to use when writing
     */
    public async write (data: string | Buffer, encoding: any = 'utf8'): Promise<boolean> {
        return new Promise((resolve, reject) =>
            this.m_socket.write(data, encoding, (error) => {
                if (error) {
                    return reject(error);
                }

                resolve(true);
            }
            ));
    }

    /**
     * Creates a new instance of a Socket by connecting to the given host and port
     * @param host the ip address to connect to
     * @param port the port to connect to
     */
    public static async connect (host: string, port: number): Promise<Socket> {
        const socket = new NetworkSocket();

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() =>
                reject(new Error('Connection attempt timed out')), 10 * 1000);

            socket.once('ready', () => {
                clearTimeout(timer);

                return resolve(new Socket(socket));
            });

            socket.once('error', (error) => {
                clearTimeout(timer);

                return reject(error);
            });

            socket.connect(port, host);
        });
    }
}
