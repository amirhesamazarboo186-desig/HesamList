const C = window.HESAMLIST_CONFIG || {};

const hasCloud = () =>
  !!(
    C.supabaseUrl &&
    !C.supabaseUrl.includes('PASTE_') &&
    C.supabaseAnonKey &&
    !C.supabaseAnonKey.includes('PASTE_')
  );

let sb = null;
let user = null;
let lists = [];
let active = null;
let items = [];
let filter = 'all';
let authMode = 'login';
let channel = null;


/* =========================================================
   HELPERS
========================================================= */

const $ = id => document.getElementById(id);

const esc = s =>
  String(s ?? '').replace(/[&<>'"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[c]));

const iconFor = type =>
  type === 'shopping' ? '🛒' : '✈️';

const roleRank = {
  viewer: 1,
  editor: 2,
  admin: 3,
  owner: 4
};

function toast(text) {
  const x = $('toast');
  if (!x) return;

  x.textContent = text;
  x.classList.add('show');

  clearTimeout(window.__toast);

  window.__toast = setTimeout(() => {
    x.classList.remove('show');
  }, 2600);
}

function msg(text, ok = false) {
  const x = $('authMessage');
  if (!x) return;

  x.textContent = text;
  x.style.color = ok
    ? 'var(--green)'
    : 'var(--red)';
}

function openModal(html) {
  $('modalContent').innerHTML = html;
  $('modal').classList.remove('hidden');
}

function closeModal() {
  $('modal').classList.add('hidden');
}

function showAuth() {
  $('authView').classList.remove('hidden');
  $('appView').classList.add('hidden');
}

function showApp() {
  $('authView').classList.add('hidden');
  $('appView').classList.remove('hidden');
}

function currentName() {
  return (
    user?.user_metadata?.display_name ||
    user?.user_metadata?.username ||
    user?.email?.split('@')[0] ||
    'کاربر'
  );
}

function roleOf() {
  return (
    active?.my_role ||
    (active?.owner_id === user?.id ? 'owner' : 'viewer')
  );
}

function canEdit() {
  return roleRank[roleOf()] >= 2;
}

function canManage() {
  return roleRank[roleOf()] >= 3;
}


/* =========================================================
   SUPABASE
========================================================= */

function initSupabase() {

  if (sb) return sb;

  if (!hasCloud()) {
    throw Error(
      'اتصال Supabase تنظیم نشده است.'
    );
  }

  if (
    typeof supabase === 'undefined' ||
    !supabase.createClient
  ) {
    throw Error(
      'کتابخانه Supabase در صفحه بارگذاری نشده است.'
    );
  }

  sb = supabase.createClient(
    C.supabaseUrl,
    C.supabaseAnonKey
  );

  return sb;
}


/* =========================================================
   USERNAME AUTH
========================================================= */

function internalEmail(username) {

  return (
    username
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '') +
    '@auth.hesamlist.local'
  );
}


/* =========================================================
   SIGN UP
========================================================= */

async function signup(username, password, name) {

  initSupabase();

  const clean =
    username
      .trim()
      .toLowerCase();

  if (!/^[a-z0-9_]{3,30}$/.test(clean)) {
    throw Error(
      'نام کاربری باید ۳ تا ۳۰ کاراکتر و فقط شامل حروف انگلیسی، عدد و _ باشد.'
    );
  }

  if (!password || password.length < 6) {
    throw Error(
      'رمز عبور باید حداقل ۶ کاراکتر باشد.'
    );
  }

  if (!name) {
    throw Error(
      'نام و نام خانوادگی را وارد کن.'
    );
  }

  const email =
    internalEmail(clean);

  const { data, error } =
    await sb.auth.signUp({
      email: email,
      password: password,

      options: {
        data: {
          username: clean,
          display_name: name
        }
      }
    });

  if (error) {
    throw error;
  }

  if (data?.user) {

    const { error: profileError } =
      await sb
        .from('profiles')
        .upsert({
          id: data.user.id,
          username: clean,
          display_name: name
        });

    if (profileError) {
      console.error(
        'Profile error:',
        profileError
      );
    }
  }

  return data;
}


/* =========================================================
   LOGIN
========================================================= */

async function login(username, password) {

  initSupabase();

  const clean =
    username
      .trim()
      .toLowerCase();

  if (!clean) {
    throw Error(
      'نام کاربری را وارد کن.'
    );
  }

  if (!password) {
    throw Error(
      'رمز عبور را وارد کن.'
    );
  }

  /*
    چون ایمیل داخلی هر Username
    به‌صورت قطعی ساخته می‌شود،
    دیگر نیازی به RPC نیست.
  */

  const email =
    internalEmail(clean);

  const result =
    await sb.auth.signInWithPassword({
      email: email,
      password: password
    });

  if (result.error) {
    throw result.error;
  }

  return result;
}


/* =========================================================
   DEMO MODE
========================================================= */

function localKey() {
  return 'hesamlist_demo_v3';
}

function demoState() {

  try {

    return (
      JSON.parse(
        localStorage.getItem(
          localKey()
        )
      ) || {
        users: [],
        lists: [],
        items: [],
        members: []
      }
    );

  } catch {

    return {
      users: [],
      lists: [],
      items: [],
      members: []
    };

  }
}

function saveDemo(state) {

  localStorage.setItem(
    localKey(),
    JSON.stringify(state)
  );
}

function demoLogin(
  username,
  name,
  signupMode
) {

  const state = demoState();

  const email =
    internalEmail(username);

  let u =
    state.users.find(
      x => x.email === email
    );

  if (signupMode) {

    if (u) {
      throw Error(
        'این نام کاربری قبلاً ثبت شده است.'
      );
    }

    u = {
      id: crypto.randomUUID(),
      email: email,
      username: username,
      name:
        name ||
        username,
      password:
        $('password').value
    };

    state.users.push(u);

    if (!state.adminId) {
      state.adminId = u.id;
    }

  } else {

    if (
      !u ||
      u.password !==
        $('password').value
    ) {
      throw Error(
        'نام کاربری یا رمز عبور اشتباه است.'
      );
    }

  }

  user = {
    id: u.id,
    email: u.email,

    user_metadata: {
      username: u.username,
      display_name: u.name,
      is_super_admin:
        state.adminId === u.id
    },

    _demo: true
  };

  localStorage.setItem(
    'hesamlist_session',
    u.id
  );

  saveDemo(state);
}


/* =========================================================
   DEMO LISTS
========================================================= */

function demoLists() {

  const state =
    demoState();

  lists =
    state.lists
      .filter(
        l =>
          l.owner_id === user.id ||
          state.members.some(
            m =>
              m.list_id === l.id &&
              m.user_id === user.id
          )
      )
      .map(l => ({

        ...l,

        my_role:
          l.owner_id === user.id
            ? 'owner'
            : (
              state.members.find(
                m =>
                  m.list_id === l.id &&
                  m.user_id === user.id
              )?.role ||
              'viewer'
            )

      }));
}

function demoItems() {

  if (!active) {
    items = [];
    return;
  }

  const state =
    demoState();

  items =
    state.items.filter(
      i =>
        i.list_id === active.id
    );
}

function demoCreateList(
  title,
  type
) {

  const state =
    demoState();

  const list = {
    id: crypto.randomUUID(),
    title,
    type,
    owner_id: user.id,
    created_at:
      new Date().toISOString()
  };

  state.lists.push(list);

  saveDemo(state);

  return list;
}

function demoAddItem(name) {

  const state =
    demoState();

  state.items.push({
    id: crypto.randomUUID(),
    list_id: active.id,
    name,
    done: false,
    created_by: user.id,
    created_at:
      new Date().toISOString()
  });

  saveDemo(state);
}

function demoUpdateItem(
  id,
  done
) {

  const state =
    demoState();

  const item =
    state.items.find(
      x => x.id === id
    );

  if (item) {
    item.done = done;
  }

  saveDemo(state);
}

function demoDeleteItem(id) {

  const state =
    demoState();

  state.items =
    state.items.filter(
      x => x.id !== id
    );

  saveDemo(state);
}


/* =========================================================
   CLOUD DATA
========================================================= */

async function cloudLists() {

  initSupabase();

  const {
    data,
    error
  } =
    await sb
      .from('lists')
      .select('*')
      .order(
        'created_at',
        {
          ascending: false
        }
      );

  if (error) {
    throw error;
  }

  const ids =
    (data || []).map(
      x => x.id
    );

  let roles = {};

  if (ids.length) {

    const r =
      await sb
        .from('list_members')
        .select(
          'list_id,role'
        )
        .eq(
          'user_id',
          user.id
        )
        .in(
          'list_id',
          ids
        );

    if (r.error) {
      throw r.error;
    }

    (r.data || [])
      .forEach(x => {
        roles[x.list_id] =
          x.role;
      });
  }

  lists =
    (data || []).map(
      l => ({
        ...l,

        my_role:
          l.owner_id === user.id
            ? 'owner'
            : roles[l.id] ||
              'viewer'
      })
    );
}

async function cloudItems() {

  initSupabase();

  if (!active) {
    items = [];
    return;
  }

  const {
    data,
    error
  } =
    await sb
      .from('items')
      .select('*')
      .eq(
        'list_id',
        active.id
      )
      .order(
        'created_at',
        {
          ascending: true
        }
      );

  if (error) {
    throw error;
  }

  items =
    data || [];
}


/* =========================================================
   LOAD DATA
========================================================= */

async function loadData() {

  if (user?._demo) {
    demoLists();
  } else {
    await cloudLists();
  }

  renderNav();
  renderDashboard();

  if (
    active &&
    lists.some(
      x =>
        x.id === active.id
    )
  ) {

    await selectList(
      active.id
    );

  } else {

    active = null;
    showDashboard();

  }
}


/* =========================================================
   NAVIGATION
========================================================= */

function renderNav() {

  if (!$('listCount')) return;

  $('listCount').textContent =
    lists.length;

  $('listNav').innerHTML =
    lists.length

      ? lists.map(
          l => `
          <button
            class="nav-item ${
              active?.id === l.id
                ? 'active'
                : ''
            }"
            data-id="${l.id}"
          >
            <span class="nav-type">
              ${iconFor(l.type)}
            </span>

            <span class="nav-name">
              ${esc(l.title)}
            </span>

            <span class="nav-badge">
              ${
                roleRank[l.my_role] >= 3
                  ? 'مدیر'
                  : ''
              }
            </span>
          </button>
        `
        ).join('')

      : `
        <div
          style="
            color:#9aa2b1;
            font-size:10px;
            padding:12px 5px
          "
        >
          هنوز لیستی ندارید.
        </div>
      `;

  document
    .querySelectorAll('.nav-item')
    .forEach(button => {

      button.onclick = () => {

        selectList(
          button.dataset.id
        );

        $('sidebar')
          ?.classList
          .remove('open');
      };

    });
}


/* =========================================================
   DASHBOARD
========================================================= */

function renderDashboard() {

  let open = 0;
  let done = 0;

  if (user?._demo) {

    const state =
      demoState();

    const ids =
      new Set(
        lists.map(
          l => l.id
        )
      );

    const its =
      state.items.filter(
        i =>
          ids.has(i.list_id)
      );

    open =
      its.filter(
        i => !i.done
      ).length;

    done =
      its.filter(
        i => i.done
      ).length;
  }

  if ($('statLists'))
    $('statLists').textContent =
      lists.length;

  if ($('statOpen'))
    $('statOpen').textContent =
      open;

  if ($('statDone'))
    $('statDone').textContent =
      done;

  if ($('statMembers'))
    $('statMembers').textContent =
      lists.length
        ? lists.length
        : 0;

  if ($('welcomeName'))
    $('welcomeName').textContent =
      currentName()
        .split(' ')[0];

  if (!$('dashboardLists'))
    return;

  $('dashboardLists').innerHTML =
    lists.map(l => {

      let its = [];

      if (user?._demo) {

        its =
          demoState()
            .items
            .filter(
              i =>
                i.list_id === l.id
            );

      }

      const d =
        its.filter(
          i => i.done
        ).length;

      const p =
        its.length
          ? Math.round(
              d /
              its.length *
              100
            )
          : 0;

      return `
        <div
          class="dash-card"
          data-dash="${l.id}"
        >

          <div class="dash-top">

            <span class="dash-icon">
              ${iconFor(l.type)}
            </span>

            <div>

              <h3>
                ${esc(l.title)}
              </h3>

              <small>
                ${
                  l.type === 'shopping'
                    ? 'لیست خرید'
                    : 'وسایل سفر'
                }
                ·
                ${its.length}
                مورد
              </small>

            </div>

          </div>

          <div class="dash-progress">

            <div class="dash-progress-top">
              <span>پیشرفت</span>
              <b>${p}%</b>
            </div>

            <div class="progress">
              <i
                style="width:${p}%"
              ></i>
            </div>

          </div>

        </div>
      `;
    }).join('');

  document
    .querySelectorAll('[data-dash]')
    .forEach(x => {

      x.onclick =
        () =>
          selectList(
            x.dataset.dash
          );

    });
}

function showDashboard() {

  $('dashboard')
    ?.classList
    .remove('hidden');

  $('listView')
    ?.classList
    .add('hidden');

  renderNav();
  renderDashboard();
}


/* =========================================================
   SELECT LIST
========================================================= */

async function selectList(id) {

  active =
    lists.find(
      x => x.id === id
    );

  if (!active) return;

  filter = 'all';

  document
    .querySelectorAll('.filter')
    .forEach(x =>
      x.classList.toggle(
        'active',
        x.dataset.filter === 'all'
      )
    );

  if (user?._demo) {
    demoItems();
  } else {
    await cloudItems();
  }

  $('dashboard')
    ?.classList
    .add('hidden');

  $('listView')
    ?.classList
    .remove('hidden');

  if ($('listTitle'))
    $('listTitle').textContent =
      active.title;

  if ($('listTypeLabel'))
    $('listTypeLabel').textContent =
      active.type === 'shopping'
        ? 'خرید'
        : 'سفر';

  if ($('listIcon'))
    $('listIcon').textContent =
      iconFor(active.type);

  renderNav();
  renderItems();

  subscribe();
}


/* =========================================================
   ITEMS
========================================================= */

function renderItems() {

  if (!active) return;

  const all =
    items.length;

  const done =
    items.filter(
      i => i.done
    ).length;

  const open =
    all - done;

  const p =
    all
      ? Math.round(
          done /
          all *
          100
        )
      : 0;

  if ($('countAll'))
    $('countAll').textContent =
      all;

  if ($('countOpen'))
    $('countOpen').textContent =
      open;

  if ($('countDone'))
    $('countDone').textContent =
      done;

  if ($('progressText'))
    $('progressText').textContent =
      p + '%';

  if ($('progressBar'))
    $('progressBar').style.width =
      p + '%';

  if ($('listMeta'))
    $('listMeta').textContent =
      `${all} مورد · ${done} مورد انجام شده`;

  $('listEmpty')
    ?.classList
    .toggle(
      'hidden',
      all !== 0
    );

  let visible =
    filter === 'open'
      ? items.filter(
          i => !i.done
        )
      : filter === 'done'
        ? items.filter(
            i => i.done
          )
        : items;

  if ($('items')) {

    $('items').innerHTML =
      visible.map(
        i => `

        <div
          class="item ${
            i.done
              ? 'done'
              : ''
          }"
        >

          <button
            class="check ${
              i.done
                ? 'done'
                : ''
            }"
            data-check="${i.id}"
            ${
              canEdit()
                ? ''
                : 'disabled'
            }
          >
            ${
              i.done
                ? '✓'
                : ''
            }
          </button>

          <span class="item-name">
            ${esc(i.name)}
          </span>

          <span class="item-meta">
            ${
              i.created_at
                ? new Date(
                    i.created_at
                  ).toLocaleDateString(
                    'fa-IR'
                  )
                : ''
            }
          </span>

          ${
            canEdit()
              ? `
                <button
                  class="item-delete"
                  data-delete="${i.id}"
                >
                  حذف
                </button>
              `
              : ''
          }

        </div>

      `
      ).join('');

  }

  document
    .querySelectorAll(
      '[data-check]'
    )
    .forEach(
      b =>
        b.onclick =
          () =>
            toggleItem(
              b.dataset.check
            )
    );

  document
    .querySelectorAll(
      '[data-delete]'
    )
    .forEach(
      b =>
        b.onclick =
          () =>
            deleteItem(
              b.dataset.delete
            )
    );

  if ($('addItemBtn'))
    $('addItemBtn').disabled =
      !canEdit();

  if ($('itemInput')) {

    $('itemInput').disabled =
      !canEdit();

    $('itemInput').placeholder =
      canEdit()
        ? 'مثلاً پاسپورت، شارژر، آب...'
        : 'شما فقط دسترسی مشاهده دارید.';

  }
}


/* =========================================================
   ADD ITEM
========================================================= */

async function addItem() {

  if (!active || !canEdit())
    return;

  const input =
    $('itemInput');

  if (!input) return;

  const name =
    input.value.trim();

  if (!name) return;

  try {

    if (user._demo) {

      demoAddItem(name);

    } else {

      initSupabase();

      const {
        error
      } =
        await sb
          .from('items')
          .insert({
            list_id:
              active.id,
            name,
            created_by:
              user.id
          });

      if (error)
        throw error;
    }

    input.value = '';

    await refreshItems();

    toast(
      'مورد اضافه شد'
    );

  } catch (e) {

    toast(
      e.message ||
      'خطا در افزودن مورد'
    );

  }
}


/* =========================================================
   REFRESH ITEMS
========================================================= */

async function refreshItems() {

  if (user._demo) {
    demoItems();
  } else {
    await cloudItems();
  }

  renderItems();
  renderDashboard();
}


/* =========================================================
   TOGGLE ITEM
========================================================= */

async function toggleItem(id) {

  if (!canEdit())
    return;

  const item =
    items.find(
      x => x.id === id
    );

  if (!item) return;

  try {

    if (user._demo) {

      demoUpdateItem(
        id,
        !item.done
      );

    } else {

      const {
        error
      } =
        await sb
          .from('items')
          .update({
            done:
              !item.done
          })
          .eq(
            'id',
            id
          );

      if (error)
        throw error;
    }

    await refreshItems();

  } catch (e) {

    toast(
      e.message ||
      'خطا'
    );

  }
}


/* =========================================================
   DELETE ITEM
========================================================= */

async function deleteItem(id) {

  if (!canEdit())
    return;

  if (
    !confirm(
      'این مورد حذف شود؟'
    )
  )
    return;

  try {

    if (user._demo) {

      demoDeleteItem(id);

    } else {

      const {
        error
      } =
        await sb
          .from('items')
          .delete()
          .eq(
            'id',
            id
          );

      if (error)
        throw error;
    }

    await refreshItems();

    toast(
      'مورد حذف شد'
    );

  } catch (e) {

    toast(
      e.message ||
      'خطا'
    );

  }
}


/* =========================================================
   CREATE LIST
========================================================= */

async function createList() {

  openModal(`

    <h2>
      ساخت لیست جدید
    </h2>

    <p class="modal-sub">
      نوع لیست را انتخاب کن؛ بعداً می‌توانی دوستانت را اضافه کنی.
    </p>

    <div class="field">

      <label>
        نام لیست
      </label>

      <input
        id="newTitle"
        placeholder="مثلاً سفر شمال ۱۴۰۵"
      >

    </div>

    <div
      class="type-grid"
    >

      <button
        class="type-choice active"
        data-type="travel"
      >
        ✈️
        <b>
          وسایل سفر
        </b>
        <small>
          چمدان، مدارک، لباس و...
        </small>
      </button>

      <button
        class="type-choice"
        data-type="shopping"
      >
        🛒
        <b>
          خرید
        </b>
        <small>
          خرید خانه، مهمانی و...
        </small>
      </button>

    </div>

    <button
      id="createConfirm"
      class="btn primary wide"
    >
      ساخت لیست
    </button>

  `);

  document
    .querySelectorAll(
      '.type-choice'
    )
    .forEach(
      b =>
        b.onclick =
          () => {

            document
              .querySelectorAll(
                '.type-choice'
              )
              .forEach(
                x =>
                  x.classList
                    .remove(
                      'active'
                    )
              );

            b.classList
              .add('active');

          }
    );

  $('createConfirm').onclick =
    async () => {

      const title =
        $('newTitle')
          .value
          .trim();

      const type =
        document
          .querySelector(
            '.type-choice.active'
          )
          .dataset
          .type;

      if (!title) {
        return toast(
          'نام لیست را وارد کن'
        );
      }

      try {

        let list;

        if (user._demo) {

          list =
            demoCreateList(
              title,
              type
            );

          demoLists();

        } else {

          initSupabase();

          const result =
            await sb
              .from('lists')
              .insert({
                title,
                type,
                owner_id:
                  user.id
              })
              .select()
              .single();

          if (result.error)
            throw result.error;

          list =
            result.data;
        }

        closeModal();

        await loadData();

        await selectList(
          list.id
        );

        toast(
          'لیست ساخته شد'
        );

      } catch (e) {

        toast(
          e.message ||
          'خطا در ساخت لیست'
        );

      }

    };
}


/* =========================================================
   DELETE LIST
========================================================= */

async function deleteList() {

  if (!active)
    return;

  if (
    !confirm(
      `لیست «${active.title}» حذف شود؟ این کار قابل بازگشت نیست.`
    )
  )
    return;

  try {

    if (user._demo) {

      const state =
        demoState();

      state.lists =
        state.lists.filter(
          x =>
            x.id !== active.id
        );

      state.items =
        state.items.filter(
          x =>
            x.list_id !== active.id
        );

      state.members =
        state.members.filter(
          x =>
            x.list_id !== active.id
        );

      saveDemo(state);

    } else {

      initSupabase();

      const result =
        await sb
          .from('lists')
          .delete()
          .eq(
            'id',
            active.id
          );

      if (result.error)
        throw result.error;
    }

    active = null;

    await loadData();

    toast(
      'لیست حذف شد'
    );

  } catch (e) {

    toast(
      e.message ||
      'خطا'
    );

  }
}


/* =========================================================
   MEMBERS
========================================================= */

async function membersModal() {

  if (!active)
    return;

  let members = [];

  if (user._demo) {

    const state =
      demoState();

    members = [
      {
        user_id:
          user.id,
        role:
          'owner',
        profile:
          state.users.find(
            u =>
              u.id === user.id
          )
      },

      ...state.members
        .filter(
          m =>
            m.list_id ===
            active.id
        )
        .map(
          m => ({
            user_id:
              m.user_id,
            role:
              m.role,
            profile:
              state.users.find(
                u =>
                  u.id ===
                  m.user_id
              )
          })
        )
    ];

  } else {

    initSupabase();

    const result =
      await sb
        .from('list_members')
        .select(
          'user_id,role,profiles(id,display_name,username)'
        )
        .eq(
          'list_id',
          active.id
        );

    if (result.error)
      throw result.error;

    members =
      result.data || [];
  }

  openModal(`

    <h2>
      اعضا و دسترسی
    </h2>

    <p class="modal-sub">
      مالک و مدیر می‌توانند اعضا را اضافه یا سطح دسترسی آن‌ها را تغییر دهند.
    </p>

    ${
      canManage()
        ? `
          <div class="invite-row">

            <input
              id="inviteEmail"
              placeholder="ایمیل دوستت"
            >

            <button
              id="inviteBtn"
              class="btn primary"
            >
              افزودن
            </button>

          </div>
        `
        : ''
    }

    <div
      id="memberList"
      style="margin-top:15px"
    >
      ${
        members
          .map(
            m =>
              memberHtml(m)
          )
          .join('')
      }
    </div>

  `);

  if (canManage()) {

    $('inviteBtn').onclick =
      () =>
        inviteMember();

  }

  document
    .querySelectorAll(
      '[data-member-role]'
    )
    .forEach(
      select =>
        select.onchange =
          () =>
            changeRole(
              select.dataset
                .memberRole,
              select.value
            )
    );
}

function memberHtml(m) {

  const name =
    m.profile?.display_name ||
    m.profile?.username ||
    m.user_id?.slice(0, 8) ||
    'کاربر';

  return `

    <div class="member">

      <div class="member-main">

        <div class="mini-avatar">
          ${esc(
            name[0] ||
            'U'
          )}
        </div>

        <div>

          <div class="member-name">
            ${esc(name)}
            ${
              m.user_id ===
              user.id
                ? '(شما)'
                : ''
            }
          </div>

        </div>

      </div>

      ${
        canManage() &&
        m.user_id !==
          active.owner_id

          ? `

            <select
              class="role-select"
              data-member-role="${m.user_id}"
            >

              <option
                value="editor"
                ${
                  m.role ===
                  'editor'
                    ? 'selected'
                    : ''
                }
              >
                ویرایشگر
              </option>

              <option
                value="viewer"
                ${
                  m.role ===
                  'viewer'
                    ? 'selected'
                    : ''
                }
              >
                فقط مشاهده
              </option>

              <option
                value="admin"
                ${
                  m.role ===
                  'admin'
                    ? 'selected'
                    : ''
                }
              >
                مدیر
              </option>

            </select>

          `

          : `

            <span class="role-select">
              ${
                m.role === 'owner'
                  ? 'مالک'
                  : m.role === 'admin'
                    ? 'مدیر'
                    : m.role === 'editor'
                      ? 'ویرایشگر'
                      : 'مشاهده'
              }
            </span>

          `
      }

    </div>
  `;
}


/* =========================================================
   INVITE MEMBER
========================================================= */

async function inviteMember() {

  const input =
    $('inviteEmail');

  if (!input)
    return;

  const email =
    input.value
      .trim()
      .toLowerCase();

  if (!email) {
    return toast(
      'ایمیل را وارد کن'
    );
  }

  try {

    if (user._demo) {

      const state =
        demoState();

      const u =
        state.users.find(
          x =>
            x.email === email
        );

      if (!u) {
        throw Error(
          'این کاربر هنوز حسابی در نسخه آزمایشی ندارد.'
        );
      }

      if (
        state.members.some(
          m =>
            m.list_id ===
              active.id &&
            m.user_id ===
              u.id
        ) ||
        u.id ===
          active.owner_id
      ) {
        throw Error(
          'این کاربر از قبل عضو است.'
        );
      }

      state.members.push({
        list_id:
          active.id,
        user_id:
          u.id,
        role:
          'editor'
      });

      saveDemo(state);

    } else {

      initSupabase();

      const result =
        await sb.rpc(
          'add_list_member_by_email',
          {
            p_list_id:
              active.id,
            p_email:
              email,
            p_role:
              'editor'
          }
        );

      if (result.error)
        throw result.error;
    }

    toast(
      'عضو اضافه شد'
    );

    await membersModal();

  } catch (e) {

    toast(
      e.message ||
      'خطا در افزودن عضو'
    );

  }
}


/* =========================================================
   CHANGE ROLE
========================================================= */

async function changeRole(
  uid,
  role
) {

  try {

    if (user._demo) {

      const state =
        demoState();

      const member =
        state.members.find(
          x =>
            x.list_id ===
              active.id &&
            x.user_id ===
              uid
        );

      if (member)
        member.role =
          role;

      saveDemo(state);

    } else {

      initSupabase();

      const result =
        await sb
          .from('list_members')
          .update({
            role
          })
          .eq(
            'list_id',
            active.id
          )
          .eq(
            'user_id',
            uid
          );

      if (result.error)
        throw result.error;
    }

    toast(
      'سطح دسترسی تغییر کرد'
    );

  } catch (e) {

    toast(
      e.message ||
      'خطا'
    );

  }
}


/* =========================================================
   ADMIN
========================================================= */

async function adminModal() {

  if (!user)
    return;

  let users = [];

  if (user._demo) {

    users =
      demoState().users;

  } else {

    initSupabase();

    const result =
      await sb
        .from('profiles')
        .select(
          'id,display_name,username,created_at'
        )
        .order(
          'created_at',
          {
            ascending: false
          }
        );

    if (result.error)
      throw result.error;

    users =
      result.data || [];
  }

  openModal(`

    <h2>
      مدیریت کاربران
    </h2>

    <p class="modal-sub">
      مدیر اصلی می‌تواند کاربران سامانه را مشاهده و کنترل کند.
    </p>

    <div>

      ${
        users
          .map(
            u => `

              <div class="member">

                <div class="member-main">

                  <div class="mini-avatar">
                    ${esc(
                      (
                        u.display_name ||
                        u.username ||
                        'U'
                      )[0]
                    )}
                  </div>

                  <div>

                    <div class="member-name">
                      ${esc(
                        u.display_name ||
                        u.username ||
                        'کاربر'
                      )}

                      ${
                        u.id ===
                        user.id
                          ? '(شما)'
                          : ''
                      }
                    </div>

                    <div class="member-email">
                      ${
                        esc(
                          u.username ||
                          ''
                        )
                      }
                    </div>

                  </div>

                </div>

                <span class="role-select">
                  ${
                    u.id ===
                    user.id
                      ? 'حساب شما'
                      : 'کاربر'
                  }
                </span>

              </div>

            `
          )
          .join('')
      }

    </div>

  `);
}


/* =========================================================
   REALTIME
========================================================= */

function subscribe() {

  if (
    user?._demo ||
    !sb ||
    !active
  )
    return;

  if (channel) {
    sb.removeChannel(
      channel
    );
  }

  channel =
    sb
      .channel(
        'hesamlist-' +
        active.id
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items',
          filter:
            'list_id=eq.' +
            active.id
        },
        async () => {

          await cloudItems();

          renderItems();

          renderDashboard();

        }
      )
      .subscribe();
}


/* =========================================================
   START CLOUD
========================================================= */

async function bootCloud() {

  initSupabase();

  const {
    data
  } =
    await sb.auth.getSession();

  if (data?.session) {

    user =
      data.session.user;

    await startApp();

  } else {

    showAuth();

  }

  sb.auth.onAuthStateChange(
    async (
      event,
      session
    ) => {

      if (
        event ===
        'INITIAL_SESSION'
      )
        return;

      if (session) {

        user =
          session.user;

        await startApp();

      } else {

        user = null;

        showAuth();

      }

    }
  );
}


/* =========================================================
   START APP
========================================================= */

async function startApp() {

  showApp();

  if ($('userName'))
    $('userName').textContent =
      currentName();

  if ($('userEmail'))
    $('userEmail').textContent =
      user?.email || '';

  if ($('avatar'))
    $('avatar').textContent =
      currentName()
        .charAt(0)
        .toUpperCase() ||
      'H';

  if ($('adminBtn')) {

    $('adminBtn')
      .classList
      .toggle(
        'hidden',
        user?.user_metadata
          ?.is_super_admin !== true &&
        !user?._demo
      );

  }

  try {

    await loadData();

  } catch (e) {

    console.error(e);

    toast(
      e.message ||
      'خطا در دریافت اطلاعات'
    );

  }
}


/* =========================================================
   DEMO BOOT
========================================================= */

function bootDemo() {

  const sid =
    localStorage.getItem(
      'hesamlist_session'
    );

  if (sid) {

    const state =
      demoState();

    const u =
      state.users.find(
        x =>
          x.id === sid
      );

    if (u) {

      user = {
        id: u.id,
        email: u.email,

        user_metadata: {
          username:
            u.username,
          display_name:
            u.name,
          is_super_admin:
            state.adminId ===
            u.id
        },

        _demo: true
      };

      startApp();

      return;
    }
  }

  showAuth();

  if ($('syncText'))
    $('syncText').textContent =
      'حالت آزمایشی محلی';
}


/* =========================================================
   AUTH FORM
========================================================= */

if ($('authForm')) {

  $('authForm').onsubmit =
    async e => {

      e.preventDefault();

      const username =
        $('username')
          ?.value
          ?.trim()
          ?.toLowerCase() ||
        '';

      const password =
        $('password')
          ?.value ||
        '';

      const name =
        $('displayName')
          ?.value
          ?.trim() ||
        '';

      try {

        if (!username) {
          throw Error(
            'نام کاربری را وارد کن.'
          );
        }

        if (!password) {
          throw Error(
            'رمز عبور را وارد کن.'
          );
        }

        if (
          password.length < 6
        ) {
          throw Error(
            'رمز عبور باید حداقل ۶ کاراکتر باشد.'
          );
        }

        if (
          authMode ===
          'signup' &&
          !name
        ) {
          throw Error(
            'نام و نام خانوادگی را وارد کن.'
          );
        }


        /* CLOUD */

        if (hasCloud()) {

          initSupabase();

          if (
            authMode ===
            'signup'
          ) {

            const result =
              await signup(
                username,
                password,
                name
              );

            if (
              !result.session
            ) {

              msg(
                'حساب ساخته شد. اگر تأیید ایمیل فعال باشد، باید ایمیل را تأیید کنی.',
                true
              );

              return;
            }

            user =
              result.user;

            toast(
              'حساب ساخته شد'
            );

            await startApp();

          } else {

            const result =
              await login(
                username,
                password
              );

            user =
              result.data.user;

            toast(
              'خوش آمدی'
            );

            await startApp();
          }

        }


        /* DEMO */

        else {

          demoLogin(
            username,
            name,
            authMode ===
              'signup'
          );

          await startApp();

          toast(
            'وارد شدید'
          );

        }

      } catch (e) {

        console.error(e);

        msg(
          e.message ||
          'عملیات ناموفق بود'
        );

      }

    };

}


/* =========================================================
   AUTH TABS
========================================================= */

document
  .querySelectorAll(
    '[data-auth]'
  )
  .forEach(btn => {

    btn.onclick = () => {

      authMode =
        btn.dataset.auth;

      document
        .querySelectorAll(
          '[data-auth]'
        )
        .forEach(x =>
          x.classList.toggle(
            'active',
            x === btn
          )
        );

      $('nameField')
        ?.classList
        .toggle(
          'hidden',
          authMode !==
            'signup'
        );

      if ($('authTitle')) {

        $('authTitle')
          .textContent =
            authMode ===
            'signup'

              ? 'حساب خودت را بساز و دوستانت را اضافه کن.'

              : 'همه‌چیز برای سفر و خرید، یک‌جا.';

      }

      if ($('authSubmit')) {

        $('authSubmit')
          .innerHTML =
            authMode ===
            'signup'

              ? 'ساخت حساب <span>←</span>'

              : 'ورود به HesamList <span>←</span>';

      }

      if ($('password'))
        $('password').value =
          '';

      msg('');

    };

  });


/* =========================================================
   BUTTONS
========================================================= */

$('newListBtn')
  ?.addEventListener(
    'click',
    createList
  );

$('sidebarNew')
  ?.addEventListener(
    'click',
    createList
  );

$('welcomeNew')
  ?.addEventListener(
    'click',
    createList
  );

$('addItemBtn')
  ?.addEventListener(
    'click',
    addItem
  );

$('itemInput')
  ?.addEventListener(
    'keydown',
    e => {

      if (
        e.key ===
        'Enter'
      ) {
        addItem();
      }

    }
  );

$('membersBtn')
  ?.addEventListener(
    'click',
    membersModal
  );

$('deleteListBtn')
  ?.addEventListener(
    'click',
    deleteList
  );

$('adminBtn')
  ?.addEventListener(
    'click',
    adminModal
  );

$('closeModal')
  ?.addEventListener(
    'click',
    closeModal
  );

$('modal')
  ?.addEventListener(
    'click',
    e => {

      if (
        e.target ===
        $('modal')
      ) {
        closeModal();
      }

    }
  );

$('mobileMenu')
  ?.addEventListener(
    'click',
    () =>
      $('sidebar')
        ?.classList
        .toggle('open')
  );

$('allListsBtn')
  ?.addEventListener(
    'click',
    showDashboard
  );


/* =========================================================
   FILTERS
========================================================= */

document
  .querySelectorAll(
    '.filter'
  )
  .forEach(btn => {

    btn.onclick = () => {

      filter =
        btn.dataset.filter;

      document
        .querySelectorAll(
          '.filter'
        )
        .forEach(x =>
          x.classList.toggle(
            'active',
            x === btn
          )
        );

      renderItems();

    };

  });


/* =========================================================
   LOGOUT
========================================================= */

$('logoutBtn')
  ?.addEventListener(
    'click',
    async () => {

      try {

        if (channel) {

          sb?.removeChannel(
            channel
          );

          channel =
            null;

        }

        if (
          sb &&
          !user?._demo
        ) {

          await sb.auth.signOut();

        }

      } catch (e) {

        console.error(e);

      }

      localStorage.removeItem(
        'hesamlist_session'
      );

      user = null;
      lists = [];
      active = null;
      items = [];

      showAuth();

      toast(
        'از حساب خارج شدید'
      );

    }
  );


/* =========================================================
   BOOT
========================================================= */

(async () => {

  try {

    if (hasCloud()) {

      await bootCloud();

    } else {

      bootDemo();

    }

  } catch (e) {

    console.error(e);

    toast(
      e.message ||
      'خطا در اجرای برنامه'
    );

    showAuth();

  }

})();
