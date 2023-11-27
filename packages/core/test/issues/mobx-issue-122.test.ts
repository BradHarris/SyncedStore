import { syncedStore, enableMobxBindings } from '@syncedstore/core';
import { observeYJS } from '@syncedstore/yjs-reactive-bindings'
import * as mobx from 'mobx';
import * as Y from 'yjs';

enableMobxBindings(mobx);

type YjsThing = {
  id: string;
};

const createSyncedStore = (doc: Y.Doc) => syncedStore({ things: [] as YjsThing[] }, doc);

class ThingSyncStore {
  doc: Y.Doc;
  store: ReturnType<typeof createSyncedStore>;
  constructor(doc: Y.Doc) {
    this.doc = doc;
    this.store = createSyncedStore(doc);

    mobx.makeAutoObservable(this, {
      doc: false,
      store: false,
    });
  }

  get thingsMap() {
    return this.store.things.reduce((acc, thing) => {
      acc[thing.id] = thing;
      return acc;
    }, {} as Record<string, YjsThing>);
  }

  addPoint(id: string) {
    this.store.things.push({
      id,
    });

    return id;
  }
}

describe('yjs syncedstore with mobx binding', () => {
  it('emits one change for each push to an array', async () => {
    const doc = new Y.Doc();
    const store = new ThingSyncStore(doc);

    const autorunSpy = jest.fn();
    mobx.autorun(() => {
      console.log(Object.keys(store.thingsMap).length);
      autorunSpy();
    });

    // when working on the store locally, we expect the autorun to fire once
    // for the things array being updated
    autorunSpy.mockClear();
    store.addPoint('1');
    expect(autorunSpy).toHaveBeenCalledTimes(1);

    autorunSpy.mockClear();
    store.addPoint('2');
    expect(autorunSpy).toHaveBeenCalledTimes(1);

    autorunSpy.mockClear();
    store.addPoint('3');
    expect(autorunSpy).toHaveBeenCalledTimes(1);

    // create a new doc which we will pretend is another client we wish to sync
    const doc2 = new Y.Doc();
    Y.applyUpdate(doc2, Y.encodeStateAsUpdateV2(doc));
    // apply updates from doc2 to doc
    doc2.on('update', (update) => {
      Y.applyUpdate(doc, update);
    });
    const things = doc2.getArray('things');
    autorunSpy.mockClear();


    // This is where the problem is, the autorun is firing once for the change
    // to the things array, but also once for each element in the array. If you
    // add 10 things, the autorun will fire 11 times. This becomes a huge problem
    // when you want to have multiplayer with a large number of items in the array.
    const thing = new Y.Map();
    thing.set('id', '4');
    things.push([thing]);
    expect(autorunSpy).toHaveBeenCalledTimes(1);
  });
});



class ThingYjsStore {
  doc: Y.Doc;

  constructor(doc: Y.Doc) {
    observeYJS(doc);
    this.doc = doc;
  }

  get things() {
    return this.doc.getArray<Y.Map<any>>('things');
  }

  get thingsMap() {
    const thingMap: Record<string, Y.Map<any>> = {};
    this.things.forEach((thing: Y.Map<any>) => {
      const id = thing.get('id');
      thingMap[id] = thing;
    });
    
    return thingMap;
  }

  addPoint(id: string) {
    const thing = new Y.Map();
    thing.set('id', id);
    this.things.push([thing]);

    return id;
  }
}

// when use only use the yjs reactive bindings then these tests pass
describe('yjs syncedstore without mobx binding', () => {

  it('emits one change for each push to an array', async () => {
    const doc = new Y.Doc();
    const store = new ThingYjsStore(doc);

    const autorunSpy = jest.fn();
    mobx.autorun(() => {
      console.log(Object.keys(store.thingsMap).length);
      autorunSpy();
    });

    // when working on the store locally, we expect the autorun to fire once
    // for the things array being updated
    autorunSpy.mockClear();
    store.addPoint('1');
    expect(autorunSpy).toHaveBeenCalledTimes(1);

    autorunSpy.mockClear();
    store.addPoint('2');
    expect(autorunSpy).toHaveBeenCalledTimes(1);

    autorunSpy.mockClear();
    store.addPoint('3');
    expect(autorunSpy).toHaveBeenCalledTimes(1);

    // create a new doc which we will pretend is another client we wish to sync
    const doc2 = new Y.Doc();
    Y.applyUpdate(doc2, Y.encodeStateAsUpdateV2(doc));
    // apply updates from doc2 to doc
    doc2.on('update', (update) => {
      Y.applyUpdate(doc, update);
    });
    const things = doc2.getArray('things');
    autorunSpy.mockClear();

    const thing = new Y.Map();
    thing.set('id', '4');
    things.push([thing]);
    expect(autorunSpy).toHaveBeenCalledTimes(1);
  });
});