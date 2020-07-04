// Copyright (c) 2020, The TurtleCoin Developers
//
// Please see the included LICENSE file for more information.

export namespace Interfaces {
    /**
     * Represents a Peer
     */
    export interface IPeer {
        /**
         * The IP address of the peer
         */
        ip: string;

        /**
         * The port of the peer
         */
        port: number;

        /**
         * The id of the peer if available
         */
        id?: string;
    }

    /**
     * Represents a raw peer list
     */
    export interface IPeerList {
        /**
         * The list of candidate peers
         */
        peers: string[];

        /**
         * The list of grey peers
         */
        grey_peers: string[];
    }
}
