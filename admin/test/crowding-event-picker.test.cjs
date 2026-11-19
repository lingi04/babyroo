// Uses the existing workspace TypeScript and React test-renderer installations.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../../server/node_modules/typescript');
const React = require('../../app/node_modules/react');
const { act, create } = require('../../app/node_modules/react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function load(name, api) {
  const source = fs.readFileSync(path.join(__dirname, '../src', name), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', js)(
    id => {
      if (id === 'react') return React;
      if (id === 'react/jsx-runtime')
        return require('../../app/node_modules/react/jsx-runtime');
      if (id.endsWith('/api/adminApi')) return api;
      if (id.endsWith('StatusBadge'))
        return load('components/StatusBadge.tsx', api);
      if (id.endsWith('CrowdingEventPicker'))
        return load('components/CrowdingEventPicker.tsx', api);
      throw new Error('Unexpected import: ' + id);
    },
    mod,
    mod.exports,
  );
  return mod.exports;
}
const event = (id, status = 'published') => ({
  id,
  title: '제목 ' + id,
  venueName: '장소 ' + id,
  address: '주소 ' + id,
  publicationStatus: status,
});
const deferred = () => {
  let resolve;
  const promise = new Promise(r => {
    resolve = r;
  });
  return { promise, resolve };
};
const button = (tree, text) =>
  tree.root
    .findAllByType('button')
    .find(node => node.children.join('') === text);
const text = tree => JSON.stringify(tree.toJSON());
const submit = tree =>
  tree.root.findByType('form').props.onSubmit({ preventDefault() {} });
async function mount(api, props = {}) {
  const { CrowdingEventPicker } = load(
    'components/CrowdingEventPicker.tsx',
    api,
  );
  let tree;
  await act(async () => {
    tree = create(
      React.createElement(CrowdingEventPicker, {
        accessToken: 'admin',
        initialEventId: '',
        refreshToken: 0,
        disabled: false,
        onSelect() {},
        ...props,
      }),
    );
  });
  return tree;
}
async function unmount(tree) {
  await act(async () => tree.unmount());
}

test('searches all states and preserves selection across paging/searching', async () => {
  const calls = [],
    selections = [];
  const tree = await mount(
    {
      listAdminEvents: async (_token, query) => {
        calls.push(query);
        return {
          count: 12,
          events: [event(query.offset ? 'B' : 'A', 'draft')],
        };
      },
    },
    { onSelect: value => selections.push(value?.id ?? null) },
  );
  try {
    assert.equal(calls[0].publicationStatus, 'all');
    assert.equal(calls[0].limit, 10);
    await act(async () =>
      tree.root.findByProps({ type: 'radio' }).props.onChange(),
    );
    await act(async () => button(tree, '다음').props.onClick());
    assert.equal(calls.at(-1).offset, 10);
    assert(text(tree).includes('ID: '));
    assert(text(tree).includes('제목 A'));
    await act(async () =>
      tree.root
        .findByProps({ type: 'search' })
        .props.onChange({ target: { value: '박물관' } }),
    );
    await act(async () => submit(tree));
    assert.equal(calls.at(-1).q, '박물관');
    assert.equal(calls.at(-1).offset, 0);
    assert.deepEqual(selections, [null, 'A']);
  } finally {
    await unmount(tree);
  }
});

test('late searches cannot overwrite the current results', async () => {
  const old = deferred(),
    latest = deferred();
  const tree = await mount({
    listAdminEvents: async (_token, query) => {
      if (query.q === 'old') return old.promise;
      if (query.q === 'new') return latest.promise;
      return { count: 0, events: [] };
    },
  });
  try {
    for (const query of ['old', 'new']) {
      await act(async () =>
        tree.root
          .findByProps({ type: 'search' })
          .props.onChange({ target: { value: query } }),
      );
      await act(async () => submit(tree));
    }
    await act(async () => latest.resolve({ count: 1, events: [event('new')] }));
    await act(async () => old.resolve({ count: 1, events: [event('old')] }));
    assert(text(tree).includes('제목 new'));
    assert(!text(tree).includes('제목 old'));
  } finally {
    await unmount(tree);
  }
});

test('direct-entry event resolves outside results and retries without selecting a substitute', async () => {
  let attempts = 0;
  const selections = [];
  const tree = await mount(
    {
      listAdminEvents: async () => ({ count: 1, events: [event('other')] }),
      getAdminEvent: async () => {
        if (!attempts++) throw Error('not found');
        return event('direct', 'hidden');
      },
    },
    {
      initialEventId: 'direct',
      onSelect: value => selections.push(value?.id ?? null),
    },
  );
  try {
    assert.deepEqual(selections, [null]);
    assert(text(tree).includes('삭제되었거나'));
    await act(async () =>
      button(tree, '선택한 이벤트 다시 불러오기').props.onClick(),
    );
    assert.deepEqual(selections, [null, null, 'direct']);
    assert(text(tree).includes('제목 direct'));
  } finally {
    await unmount(tree);
  }
});

test('list failures preserve selection and retry the submitted search', async () => {
  let fail = false;
  const selections = [];
  const queries = [];
  const tree = await mount(
    {
      listAdminEvents: async (_token, query) => {
        queries.push(query.q);
        if (fail) throw Error('offline');
        return { count: 1, events: [event('A')] };
      },
    },
    { onSelect: value => selections.push(value?.id ?? null) },
  );
  try {
    await act(async () =>
      tree.root.findByProps({ type: 'radio' }).props.onChange(),
    );
    fail = true;
    await act(async () =>
      tree.root
        .findByProps({ type: 'search' })
        .props.onChange({ target: { value: '박물관' } }),
    );
    await act(async () => submit(tree));
    assert(text(tree).includes('제목 A'));
    assert(text(tree).includes('목록을 불러오지 못했습니다'));
    fail = false;
    await act(async () => button(tree, '목록 다시 불러오기').props.onClick());
    assert.equal(queries.at(-1), '박물관');
    assert.equal(tree.root.findByProps({ type: 'radio' }).props.checked, true);
    assert.deepEqual(selections, [null, 'A']);
  } finally {
    await unmount(tree);
  }
});

test('changing selected event clears verification and disconnect uses its ID without any active areas', async () => {
  const calls = [];
  let areaReads = 0;
  const { CrowdingPage } = load('pages/CrowdingPage.tsx', {
    listAdminEvents: async () => ({
      count: 2,
      events: [event('A'), event('B')],
    }),
    crowdingRequest: async (_token, url, method) => {
      calls.push({ url, method });
      if (url === '/areas')
        return areaReads++ === 0
          ? [{ id: 'POI008', name: '경복궁', active: true }]
          : [];
      if (method === 'DELETE') return { saved: true };
      return {
        fingerprint: 'f',
        event: event('A'),
        area: { boundaryUrl: 'https://data.seoul.go.kr/' },
      };
    },
  });
  const previousWindow = globalThis.window;
  globalThis.window = { confirm: () => true };
  let tree;
  await act(async () => {
    tree = create(
      React.createElement(CrowdingPage, {
        accessToken: 'admin',
        refreshToken: 0,
      }),
    );
  });
  try {
    await act(async () =>
      tree.root.findByProps({ type: 'radio', value: 'A' }).props.onChange(),
    );
    const region = tree.root
      .findAllByType('select')
      .find(node =>
        node
          .findAllByType('option')
          .some(option => option.props.value === 'POI008'),
      );
    await act(async () =>
      region.props.onChange({ target: { value: 'POI008' } }),
    );
    const mappingForm = button(tree, '장소 정보 확인').parent.parent;
    await act(async () => mappingForm.props.onSubmit({ preventDefault() {} }));
    assert(button(tree, '연결 저장'));
    await act(async () =>
      tree.root.findByProps({ type: 'radio', value: 'B' }).props.onChange(),
    );
    assert.equal(button(tree, '연결 저장'), undefined);
    await act(async () =>
      tree.update(
        React.createElement(CrowdingPage, {
          accessToken: 'admin',
          refreshToken: 1,
        }),
      ),
    );
    assert(text(tree).includes('등록된 지역이 없습니다'));
    await act(async () => button(tree, '연결 해제').props.onClick());
    assert.deepEqual(calls.at(-1), { url: '/events/B', method: 'DELETE' });
  } finally {
    globalThis.window = previousWindow;
    await unmount(tree);
  }
});
