// Copyright (c) 2020, The TurtleCoin Developers
//
// Please see the included LICENSE file for more information.

import { Socket } from './Socket';

/**
 * Represents a singular network client connection (incoming or outgoing)
 */
export class NetworkClient extends Socket {
    /**
     * Constructs an instance of the class
     * @param socket the socket to construct against
     * @param id the id of the peer
     * @param maxListeners max number of event listeners
     */
    constructor (socket: Socket, id?: string, maxListeners = 10) {
        super(socket, maxListeners, id);
    }

    /**
     * Creates a new instance by connecting to the peer with the given information
     * @param ip the ip address of the peer
     * @param port the port of the peer
     * @param id the id of the peer if known
     * @param graceful whether we should gracefully try to connect
     */
    public static async start (
        ip: string,
        port: number,
        id?: string,
        graceful = true
    ): Promise<NetworkClient | undefined> {
        try {
            const socket = await Socket.connect(ip, port);

            return new NetworkClient(socket, id);
        } catch (e) {
            if (graceful) {

            } else {
                throw e;
            }
        }
    }

    /**
     * Whether the client is connected
     */
    public get connected (): boolean {
        return !this.connecting &&
            !this.destroyed &&
            (typeof this.remoteAddress !== 'undefined') &&
            (typeof this.remotePort !== 'undefined');
    }
}
