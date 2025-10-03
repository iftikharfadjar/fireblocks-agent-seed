import https from 'https';
import jwt from 'jsonwebtoken';
import { JWT, PairingToken } from 'types';
import { AGENT_VERSION } from '../version';
import deviceService, { DeviceData } from './device.service';
import fbServerApi from './fb-server.api';
import logger from './logger';
import messageService from './messages.service';
export interface FireblocksAgent {
  pairDevice(pairingToken: JWT): void;
  runAgentMainLoop(httpsAgent: https.Agent): Promise<void>;
  isValidPairingToken(pairingToken: JWT): boolean;
}

class FireblocksAgentImpl implements FireblocksAgent {
  async pairDevice(pairingToken: string) {
    const { userId } = jwt.decode(pairingToken) as PairingToken;
    const { refreshToken, deviceId } = await fbServerApi.pairDevice({
      userId,
      pairingToken,
    });
    deviceService.saveDeviceData({ userId, deviceId, refreshToken });
  }

  runAgentMainLoop = async (httpsAgent: https.Agent) => {
    while (true) {
      try {
        await this._runLoopStep(httpsAgent);
      } catch (e) {
        logger.error(`Error in agent main loop ${e}`);
      }
    }
  };

  isValidPairingToken(pairingToken: JWT): boolean {
    try {
      const { userId } = jwt.decode(pairingToken) as DeviceData;
      return userId.length > 0;
    } catch (e) {
      return false;
    }
  }

  _runLoopStep = async (httpsAgent) => {
    const start = Date.now();
    logger.info(`Waiting for messages from Fireblocks... (version=${AGENT_VERSION})`);
    const messages = await fbServerApi.getMessages();
    logger.info(`Got ${messages.length} messages from Fireblocks after ${Date.now() - start}ms`);
    messageService.handleMessages(messages, httpsAgent).catch((e) => {
      logger.error(`Error in agent handle messages ${e}`);
    });
  };
}

export default new FireblocksAgentImpl();
