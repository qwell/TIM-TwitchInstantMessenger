import Database from './db.js';
import Parameter, { ParameterTypes } from './parameter.js';
import SNAC, { FoodGroups, Types } from './snac.js';
import Util from './util.js';
import SessionManager, { Session } from './sessionmanager.js';

const db = new Database();

class User {
  // FIXME: Add proper types.
  ID: number = -1;
  ScreenName: string = '';
  FormattedScreenName: string = '';
  Password: string = '';
  TemporaryEvil: number = 0;
  PermanentEvil: number = 0;
  EmailAddress: string = '';
  Class: 0x10 | 0x12 = 0x10;
  Confirmed: boolean = false;
  Internal: boolean = false;
  Suspended: boolean = false;
  Deleted: boolean = false;
  Notes: string = '';
  LastSignonDate: Date = new Date(0);
  CreationDate: Date = new Date(0);
  SignedOnTimestamp: Date = new Date(0);
  LoggedIPAddresses: string = '';
  RegisteredIPAddress: string = '';
  FeedbagTimestamp: Date = new Date(0);
  FeedbagItems: number = 0;
  SignedOn: boolean = false;
  AwayMessageEncoding: string = '';
  AwayMessage: string = '';
  ProfileEncoding: string = '';
  Profile: Buffer = Util.Bit.ToBuffer();
  Certs: Buffer = Util.Bit.ToBuffer();
  Capabilities: Buffer = Util.Bit.ToBuffer();

  constructor(a: User) {
    return structuredClone(a);
  }
  async getFeedbagBuddyList() {
    const c = await db.getBuddyList(this.ID);
    return c ? c : [];
  }
  async getFeedbagTimestamp() {
    const c = await db.getFeedbagTimestamp(this.ID);
    return c ? c : new Date(Util.Dates.GetTimestamp());
  }
  async updateStatus(
    session: Session,
    sessions: SessionManager,
    sendDataCallback: {
      // sendData()
      (session: Session, requestId: number, channel: number, snac: SNAC | number[], extra?: number[]): void;
    }
  ) {
    const onBuddyList = await db.getOnBuddyList(this.ScreenName);
    const myBuddyList = await db.getBuddyList(this.ID);

    const onBuddyListSessions = sessions.collection.filter((item) => {
      return item.user && onBuddyList.indexOf(item.user.ID) > -1;
    });
    const myBuddyListSessions = sessions.collection.filter((item) => {
      return myBuddyList.find((i) => {
        return item.user && i.Name === item.user.ScreenName && i.ClassID === 0;
      });
    });

    onBuddyListSessions.forEach((item) => {
      if (item.socket) {
        if (this.SignedOn) {
          sendDataCallback(
            item,
            0,
            2,
            new SNAC(
              {
                foodGroup: FoodGroups.BUDDY,
                type: Types.ELEVEN,
                flags: 0,
                requestId: 0,
              },
              {
                parameters: [
                  new Parameter({
                    type: ParameterTypes.ONE,
                    data: Util.Bit.ToBuffer(
                      Util.Bit.UInt32ToBytes(Util.Bit.UserClass(this.Class, this.AwayMessage.length ? true : false))
                    ),
                  }),
                  new Parameter({
                    type: ParameterTypes.THREE,
                    data: Util.Bit.ToBuffer(Util.Bit.UInt32ToBytes(this.SignedOnTimestamp.getTime())),
                  }),
                  new Parameter({
                    type: ParameterTypes.THIRTEEN,
                    data: this.Capabilities,
                  }),
                  new Parameter({
                    type: ParameterTypes.FIFTEEN,
                    data: Util.Bit.ToBuffer(Util.Bit.UInt32ToBytes(0)),
                  }),
                ],
                extensions: {
                  formattedScreenName: this.FormattedScreenName,
                },
              }
            )
          );
        } else {
          sendDataCallback(
            item,
            0,
            2,
            new SNAC(
              {
                foodGroup: FoodGroups.BUDDY,
                type: Types.TWELVE,
                flags: 0,
                requestId: 0,
              },
              {
                parameters: [
                  new Parameter({
                    type: ParameterTypes.ONE,
                    data: Util.Bit.ToBuffer(Util.Bit.UInt16ToBytes(0)),
                  }),
                ],
                extensions: {
                  formattedScreenName: this.FormattedScreenName,
                },
              }
            )
          );
        }
      }
    });
    if (session.socket) {
      myBuddyListSessions.forEach((item) => {
        if (item.user?.SignedOn) {
          sendDataCallback(
            session,
            0,
            2,
            new SNAC(
              {
                foodGroup: FoodGroups.BUDDY,
                type: Types.TWELVE,
                flags: 0,
                requestId: 0,
              },
              {
                parameters: [
                  new Parameter({
                    type: ParameterTypes.ONE,
                    data: Util.Bit.ToBuffer(
                      Util.Bit.UInt32ToBytes(
                        Util.Bit.UserClass(
                          item.user.Class,
                          item.user.AwayMessage && item.user.AwayMessage.length ? true : false
                        )
                      )
                    ),
                  }),
                  new Parameter({
                    type: ParameterTypes.THREE,
                    data: Util.Bit.ToBuffer(Util.Bit.UInt32ToBytes(item.user.SignedOnTimestamp.getTime())),
                  }),
                  new Parameter({
                    type: ParameterTypes.THIRTEEN,
                    data: item.user.Capabilities,
                  }),
                  new Parameter({
                    type: ParameterTypes.FIFTEEN,
                    data: Util.Bit.ToBuffer(Util.Bit.UInt32ToBytes(0)),
                  }),
                ],
                extensions: {
                  formattedScreenName: item.user.FormattedScreenName,
                },
              }
            )
          );
        } else {
          sendDataCallback(
            item,
            0,
            2,
            new SNAC(
              {
                foodGroup: FoodGroups.BUDDY,
                type: 0x000c,
                flags: 0,
                requestId: 0,
              },
              {
                parameters: [
                  new Parameter({
                    type: ParameterTypes.ONE,
                    data: Util.Bit.ToBuffer(Util.Bit.UInt16ToBytes(0)),
                  }),
                ],
                extensions: {
                  formattedScreenName: item.user?.FormattedScreenName,
                },
              }
            )
          );
        }
      });
    }
  }
  async updateAdminInfo() {
    await db.updateAdminInfo(this.ID, this.FormattedScreenName, this.EmailAddress);
  }
  async addFeedbagItem(name: string, groupId: number, itemId: number, classId: number, attributes: number[]) {
    return await db.addFeedbagItem(this.ID, name, groupId, itemId, classId, Util.Bit.ToBuffer(attributes));
  }
  async updateFeedbagItem(name: string, groupId: number, itemId: number, classId: number, attributes: number[]) {
    const b = await db.getBuddyList(this.ID);
    const c = b.find((item) => {
      return item.ID == this.ID && item.GroupID == groupId && item.BuddyID == itemId && item.ClassID == classId;
    });
    if (c) {
      const d = await db.updateFeedbagItem(c.ID, name, c.GroupID, c.BuddyID, c.ClassID, Util.Bit.ToBuffer(attributes));
      if (d) {
        return d;
      }
      return c;
    }
    return b;
  }
  async deleteFeedbagItem(name: string, groupId: number, itemId: number, classId: number, attributes: number[]) {
    const b = await db.getBuddyList(this.ID);
    const c = b.find((item) => {
      return (
        item.ID == this.ID &&
        item.Name == name &&
        item.GroupID == groupId &&
        item.BuddyID == itemId &&
        item.ClassID == classId
      );
    });
    if (c) {
      const d = await db.deleteFeedbagItem(
        c.ID,
        c.Name,
        c.GroupID,
        c.BuddyID,
        c.ClassID,
        Util.Bit.ToBuffer(attributes)
      );
      if (d) {
        return d;
      }
      return c;
    }
    return null;
  }
  async updateFeedbagMeta(): Promise<void> {
    const b = (await db.updateFeedbagMeta(this.ID)) as { timestamp: Date; count: number };
    if (b) {
      this.FeedbagTimestamp = b.timestamp;
      this.FeedbagItems = b.count;
    }
    return;
  }
  static async getSingleUser(screenName: string) {
    console.log(screenName);
    const b = await db.getUser(screenName);

    return b ? new User(b) : null;
  }
}

export default User;
