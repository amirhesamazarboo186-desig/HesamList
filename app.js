/* =========================================================
   HESAMLIST - APP.JS
========================================================= */

const C = window.HESAMLIST_CONFIG || {};

const hasCloud = () =>
  !!(
    C.supabaseUrl &&
    !C.supabaseUrl.includes("PASTE_") &&
    C.supabaseAnonKey &&
    !C.supabaseAnonKey.includes("PASTE_")
  );

let sb = null;
let user = null;
let profile = null;
let lists = [];
let active = null;
let items = [];
let filter = "all";
let authMode = "login";
let channel = null;


/* =========================================================
   HELPERS
========================================================= */

const $ = id => document.getElementById(id);

const esc = s =>
  String(s ?? "").replace(
    /[&<>'"]/g,
    c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    }[c])
  );

const iconFor = type =>
  type === "shopping" ? "🛒" : "✈️";

const roleRank = {
  viewer: 1,
  editor: 2,
  admin: 3,
  owner: 4
};

function toast(text) {
  const x = $("toast");

  if (!x) return;

  x.textContent = text;
  x.classList.add("show");

  clearTimeout(window.__toast);

  window.__toast = setTimeout(() => {
    x.classList.remove("show");
  }, 2600);
}

function msg(text, ok = false) {
  const x = $("authMessage");

  if (!x) return;

  x.textContent = text;
  x.style.color = ok
    ? "var(--green)"
    : "var(--red)";
}

function openModal(html) {
  const content = $("modalContent");
  const modal = $("modal");

  if (!content || !modal) return;

  content.innerHTML = html;
  modal.classList.remove("hidden");
}

function closeModal() {
  const modal = $("modal");

  if (modal) {
    modal.classList.add("hidden");
  }
}

function showAuth() {
  $("authView")?.classList.remove("hidden");
  $("appView")?.classList.add("hidden");
}

function showApp() {
  $("authView")?.classList.add("hidden");
  $("appView")?.classList.remove("hidden");
}


/* =========================================================
   USER
========================================================= */

function currentName() {
  return (
    profile?.display_name ||
    user?.user_metadata?.display_name ||
    profile?.username ||
    user?.user_metadata?.username ||
    "کاربر"
  );
}

function roleOf() {
  return (
    active?.my_role ||
    (
      active?.owner_id === user?.id
        ? "owner"
        : "viewer"
    )
  );
}

function canEdit() {
  return roleRank[roleOf()] >= 2;
}

function canManage() {
  return roleRank[roleOf()] >= 3;
}


/* =========================================================
   USERNAME AUTH
========================================================= */

function internalEmail(username) {
  return (
    username
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "") +
    "@auth.hesamlist.local"
  );
}


/* =========================================================
   SIGN UP
========================================================= */

async function signup(username, password, name) {

  if (!hasCloud()) {
    throw Error("اتصال Supabase تنظیم نشده است.");
  }

  if (!sb) {
    sb = supabase.createClient(
      C.supabaseUrl,
      C.supabaseAnonKey
    );
  }

  const clean =
    username
      .trim()
      .toLowerCase();

  if (!/^[a-z0-9_]{3,30}$/.test(clean)) {
    throw Error(
      "نام کاربری باید ۳ تا ۳۰ کاراکتر و فقط شامل حروف انگلیسی، عدد و _ باشد."
    );
  }

  if (!password || password.length < 6) {
    throw Error(
      "رمز عبور باید حداقل ۶ کاراکتر باشد."
    );
  }

  if (!name) {
    throw Error(
      "نام و نام خانوادگی را وارد کن."
    );
  }

  const email =
    internalEmail(clean);

  const { data, error } =
    await sb.auth.signUp({
      email,
      password,
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
        .from("profiles")
        .upsert({
          id: data.user.id,
          username: clean,
          display_name: name
        });

    if (profileError) {
      console.error(
        "Profile error:",
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

  if (!hasCloud()) {
    throw Error("اتصال Supabase تنظیم نشده است.");
  }

  if (!sb) {
    sb = supabase.createClient(
      C.supabaseUrl,
      C.supabaseAnonKey
    );
  }

  const clean =
    username
      .trim()
      .toLowerCase();

  if (!clean) {
    throw Error(
      "نام کاربری را وارد کن."
    );
  }

  if (!password) {
    throw Error(
      "رمز عبور را وارد کن."
    );
  }

  const rpcResult =
    await sb.rpc(
      "get_auth_email_by_username",
      {
        p_username: clean
      }
    );

  if (rpcResult.error) {
    throw rpcResult.error;
  }

  let email =
    Array.isArray(rpcResult.data)
      ? rpcResult.data[0]
      : rpcResult.data;

  /*
    اگر RPC مقدار را به شکل object برگرداند
  */

  if (
    email &&
    typeof email === "object"
  ) {
    email =
      email.email ||
      email.auth_email ||
      email.get_auth_email_by_username;
  }

  if (!email) {
    /*
      روش مستقیم برای سیستم داخلی
    */

    email = internalEmail(clean);
  }

  const result =
    await sb.auth.signInWithPassword({
      email,
      password
    });

  if (result.error) {
    throw result.error;
  }

  return result;
}


/* =========================================================
   PROFILE
========================================================= */

async function loadProfile() {

  if (!user || user._demo || !sb) {
    return;
  }

  const { data, error } =
    await sb
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

  if (error) {
    console.error(
      "Profile load error:",
      error
    );
    return;
  }

  profile = data || {
    id: user.id,
    username:
      user.user_metadata?.username || "",
    display_name:
      user.user_metadata?.display_name ||
      "کاربر"
  };
}


/* =========================================================
   DEMO MODE
========================================================= */

function localKey() {
  return "hesamlist_demo_v3";
}

function demoState() {

  try {

    return (
      JSON.parse(
        localStorage.getItem(localKey())
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
  isSignup,
  password
) {

  let s = demoState();

  const clean =
    username
      .trim()
      .toLowerCase();

  let u =
    s.users.find(
      x => x.username === clean
    );

  if (isSignup) {

    if (u) {
      throw Error(
        "این نام کاربری قبلاً ثبت شده است."
      );
    }

    u = {
      id: crypto.randomUUID(),
      username: clean,
      name:
        name || clean,
      password
    };

    s.users.push(u);

    if (!s.adminId) {
      s.adminId = u.id;
    }

  } else {

    if (
      !u ||
      u.password !== password
    ) {
      throw Error(
        "نام کاربری یا رمز عبور اشتباه است."
      );
    }

  }

  user = {
    id: u.id,
    email: "",
    user_metadata: {
      username: u.username,
      display_name: u.name
    },
    _demo: true
  };

  profile = {
    id: u.id,
    username: u.username,
    display_name: u.name
  };

  localStorage.setItem(
    "hesamlist_session",
    u.id
  );

  saveDemo(s);
}

function demoLists() {

  const s = demoState();

  lists =
    s.lists
      .filter(
        l =>
          l.owner_id === user.id ||
          s.members.some(
            m =>
              m.list_id === l.id &&
              m.user_id === user.id
          )
      )
      .map(l => ({
        ...l,
        my_role:
          l.owner_id === user.id
            ? "owner"
            : (
              s.members.find(
                m =>
                  m.list_id === l.id &&
                  m.user_id === user.id
              )?.role ||
              "viewer"
            )
      }));
}

function demoItems() {

  if (!active) {
    items = [];
    return;
  }

  const s = demoState();

  items =
    s.items.filter(
      i =>
        i.list_id === active.id
    );
}

function demoCreateList(
  title,
  type
) {

  const s = demoState();

  const list = {
    id: crypto.randomUUID(),
    title,
    type,
    owner_id: user.id,
    created_at:
      new Date().toISOString()
  };

  s.lists.push(list);

  saveDemo(s);

  return list;
}

function demoAddItem(name) {

  const s = demoState();

  s.items.push({
    id: crypto.randomUUID(),
    list_id: active.id,
    name,
    done: false,
    created_by: user.id,
    created_at:
      new Date().toISOString()
  });

  saveDemo(s);
}

function demoUpdateItem(
  id,
  done
) {

  const s = demoState();

  const item =
    s.items.find(
      x => x.id === id
    );

  if (item) {
    item.done = done;
  }

  saveDemo(s);
}

function demoDeleteItem(id) {

  const s = demoState();

  s.items =
    s.items.filter(
      x => x.id !== id
    );

  saveDemo(s);
}


/* =========================================================
   CLOUD DATA
========================================================= */

async function cloudLists() {

  if (!sb || !user) {
    throw Error(
      "اتصال به Supabase برقرار نیست."
    );
  }

  const { data, error } =
    await sb
      .from("lists")
      .select("*")
      .order(
        "created_at",
        {
          ascending: false
        }
      );

  if (error) {
    throw error;
  }

  const allLists = data || [];

  const ids =
    allLists.map(
      x => x.id
    );

  let roles = {};

  if (ids.length) {

    const r =
      await sb
        .from("list_members")
        .select(
          "list_id,role"
        )
        .eq(
          "user_id",
          user.id
        )
        .in(
          "list_id",
          ids
        );

    if (!r.error) {

      (r.data || [])
        .forEach(x => {
          roles[x.list_id] =
            x.role;
        });

    }

  }

  lists =
    allLists.map(l => ({
      ...l,
      my_role:
        l.owner_id === user.id
          ? "owner"
          : roles[l.id] ||
            "viewer"
    }));
}

async function cloudItems() {

  if (!sb || !active) {
    items = [];
    return;
  }

  const { data, error } =
    await sb
      .from("items")
      .select("*")
      .eq(
        "list_id",
        active.id
      )
      .order(
        "created_at",
        {
          ascending: true
        }
      );

  if (error) {
    throw error;
  }

  items = data || [];
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
      x => x.id === active.id
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

  const count =
    $("listCount");

  const nav =
    $("listNav");

  if (count) {
    count.textContent =
      lists.length;
  }

  if (!nav) return;

  nav.innerHTML =
    lists.length
      ? lists
        .map(
          l => `
          <button
            class="nav-item ${
              active?.id === l.id
                ? "active"
                : ""
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
                  ? "مدیر"
                  : ""
              }
            </span>
          </button>
        `
        )
        .join("")
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
    .querySelectorAll(".nav-item")
    .forEach(btn => {

      btn.onclick = () => {

        selectList(
          btn.dataset.id
        );

        $("sidebar")
          ?.classList
          .remove("open");

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

    const s =
      demoState();

    const ids =
      new Set(
        lists.map(
          l => l.id
        )
      );

    const its =
      s.items.filter(
        i =>
          ids.has(
            i.list_id
          )
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

  $("statLists") &&
    ($("statLists").textContent =
      lists.length);

  $("statOpen") &&
    ($("statOpen").textContent =
      open);

  $("statDone") &&
    ($("statDone").textContent =
      done);

  $("statMembers") &&
    ($("statMembers").textContent =
      lists.length
        ? Math.max(
            1,
            new Set(
              lists.map(
                x => x.owner_id
              )
            ).size
          )
        : 0);

  if ($("welcomeName")) {
    $("welcomeName").textContent =
      currentName()
        .split(" ")[0];
  }

  const dashboard =
    $("dashboardLists");

  if (!dashboard) return;

  dashboard.innerHTML =
    lists
      .map(l => {

        let its = [];

        if (user?._demo) {
          its =
            demoState()
              .items
              .filter(
                i =>
                  i.list_id ===
                  l.id
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
                    l.type === "shopping"
                      ? "لیست خرید"
                      : "وسایل سفر"
                  }
                  ·
                  ${its.length}
                  مورد
                </small>

              </div>

            </div>

            <div class="dash-progress">

              <div class="dash-progress-top">
                <span>
                  پیشرفت
                </span>

                <b>
                  ${p}%
                </b>
              </div>

              <div class="progress">
                <i
                  style="width:${p}%"
                ></i>
              </div>

            </div>

          </div>
        `;

      })
      .join("");

  document
    .querySelectorAll("[data-dash]")
    .forEach(x => {

      x.onclick = () =>
        selectList(
          x.dataset.dash
        );

    });
}

function showDashboard() {

  $("dashboard")
    ?.classList
    .remove("hidden");

  $("listView")
    ?.classList
    .add("hidden");

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

  filter = "all";

  document
    .querySelectorAll(".filter")
    .forEach(x =>
      x.classList.toggle(
        "active",
        x.dataset.filter === "all"
      )
    );

  if (user?._demo) {
    demoItems();
  } else {
    await cloudItems();
  }

  $("dashboard")
    ?.classList
    .add("hidden");

  $("listView")
    ?.classList
    .remove("hidden");

  if ($("listTitle")) {
    $("listTitle").textContent =
      active.title;
  }

  if ($("listTypeLabel")) {
    $("listTypeLabel").textContent =
      active.type === "shopping"
        ? "خرید"
        : "سفر";
  }

  if ($("listIcon")) {
    $("listIcon").textContent =
      iconFor(active.type);
  }

  renderNav();
  renderItems();
  subscribe();
}


/* =========================================================
   ITEMS
========================================================= */

function renderItems() {

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

  $("countAll") &&
    ($("countAll").textContent =
      all);

  $("countOpen") &&
    ($("countOpen").textContent =
      open);

  $("countDone") &&
    ($("countDone").textContent =
      done);

  $("progressText") &&
    ($("progressText").textContent =
      p + "%");

  $("progressBar") &&
    ($("progressBar").style.width =
      p + "%");

  $("listMeta") &&
    ($("listMeta").textContent =
      `${all} مورد · ${done} مورد انجام شده`);

  $("listEmpty")
    ?.classList
    .toggle(
      "hidden",
      all !== 0
    );

  let visible =
    filter === "open"
      ? items.filter(
          i => !i.done
        )
      : filter === "done"
        ? items.filter(
            i => i.done
          )
        : items;

  const container =
    $("items");

  if (!container) return;

  container.innerHTML =
    visible
      .map(
        i => `
          <div
            class="item ${
              i.done
                ? "done"
                : ""
            }"
          >

            <button
              class="check ${
                i.done
                  ? "done"
                  : ""
              }"
              data-check="${i.id}"
              ${
                canEdit()
                  ? ""
                  : "disabled"
              }
            >
              ${
                i.done
                  ? "✓"
                  : ""
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
                      "fa-IR"
                    )
                  : ""
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
                : ""
            }

          </div>
        `
      )
      .join("");

  document
    .querySelectorAll(
      "[data-check]"
    )
    .forEach(btn => {

      btn.onclick = () =>
        toggleItem(
          btn.dataset.check
        );

    });

  document
    .querySelectorAll(
      "[data-delete]"
    )
    .forEach(btn => {

      btn.onclick = () =>
        deleteItem(
          btn.dataset.delete
        );

    });

  if ($("addItemBtn")) {
    $("addItemBtn").disabled =
      !canEdit();
  }

  if ($("itemInput")) {

    $("itemInput").disabled =
      !canEdit();

    $("itemInput").placeholder =
      canEdit()
        ? "مثلاً پاسپورت، شارژر، آب..."
        : "شما فقط دسترسی مشاهده دارید.";

  }
}

async function addItem() {

  const input =
    $("itemInput");

  if (!input) return;

  const name =
    input.value.trim();

  if (
    !name ||
    !active ||
    !canEdit()
  ) {
    return;
  }

  try {

    if (user?._demo) {

      demoAddItem(name);

    } else {

      const { error } =
        await sb
          .from("items")
          .insert({
            list_id:
              active.id,
            name,
            created_by:
              user.id
          });

      if (error) {
        throw error;
      }

    }

    input.value = "";

    await refreshItems();

    toast(
      "مورد اضافه شد"
    );

  } catch (e) {

    toast(
      e.message ||
      "خطا در افزودن مورد"
    );

  }
}

async function refreshItems() {

  if (user?._demo) {
    demoItems();
  } else {
    await cloudItems();
  }

  renderItems();
  renderDashboard();
}

async function toggleItem(id) {

  if (!canEdit()) return;

  const item =
    items.find(
      x => x.id === id
    );

  if (!item) return;

  try {

    if (user?._demo) {

      demoUpdateItem(
        id,
        !item.done
      );

    } else {

      const { error } =
        await sb
          .from("items")
          .update({
            done:
              !item.done
          })
          .eq(
            "id",
            id
          );

      if (error) {
        throw error;
      }

    }

    await refreshItems();

  } catch (e) {

    toast(
      e.message ||
      "خطا"
    );

  }
}

async function deleteItem(id) {

  if (!canEdit()) return;

  if (
    !confirm(
      "این مورد حذف شود؟"
    )
  ) {
    return;
  }

  try {

    if (user?._demo) {

      demoDeleteItem(id);

    } else {

      const { error } =
        await sb
          .from("items")
          .delete()
          .eq(
            "id",
            id
          );

      if (error) {
        throw error;
      }

    }

    await refreshItems();

    toast(
      "مورد حذف شد"
    );

  } catch (e) {

    toast(
      e.message ||
      "خطا"
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

    <div class="type-grid">

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
      ".type-choice"
    )
    .forEach(btn => {

      btn.onclick = () => {

        document
          .querySelectorAll(
            ".type-choice"
          )
          .forEach(
            x =>
              x.classList.remove(
                "active"
              )
          );

        btn.classList.add(
          "active"
        );

      };

    });

  $("createConfirm").onclick =
    async () => {

      const title =
        $("newTitle")
          ?.value
          ?.trim();

      const selected =
        document.querySelector(
          ".type-choice.active"
        );

      const type =
        selected?.dataset.type ||
        "travel";

      if (!title) {
        return toast(
          "نام لیست را وارد کن"
        );
      }

      try {

        let list;

        if (user?._demo) {

          list =
            demoCreateList(
              title,
              type
            );

          demoLists();

        } else {

          const result =
            await sb
              .from("lists")
              .insert({
                title,
                type,
                owner_id:
                  user.id
              })
              .select()
              .single();

          if (result.error) {
            throw result.error;
          }

          list =
            result.data;

        }

        closeModal();

        await loadData();

        await selectList(
          list.id
        );

        toast(
          "لیست ساخته شد"
        );

      } catch (e) {

        toast(
          e.message ||
          "خطا در ساخت لیست"
        );

      }

    };
}


/* =========================================================
   DELETE LIST
========================================================= */

async function deleteList() {

  if (!active) return;

  if (
    !confirm(
      `لیست «${active.title}» حذف شود؟ این کار قابل بازگشت نیست.`
    )
  ) {
    return;
  }

  try {

    if (user?._demo) {

      let s =
        demoState();

      s.lists =
        s.lists.filter(
          x =>
            x.id !==
            active.id
        );

      s.items =
        s.items.filter(
          x =>
            x.list_id !==
            active.id
        );

      s.members =
        s.members.filter(
          x =>
            x.list_id !==
            active.id
        );

      saveDemo(s);

    } else {

      const result =
        await sb
          .from("lists")
          .delete()
          .eq(
            "id",
            active.id
          );

      if (result.error) {
        throw result.error;
      }

    }

    active = null;

    await loadData();

    toast(
      "لیست حذف شد"
    );

  } catch (e) {

    toast(
      e.message ||
      "خطا"
    );

  }
}


/* =========================================================
   MEMBERS
========================================================= */

async function membersModal() {

  if (!active) return;

  let members = [];

  if (user?._demo) {

    const s =
      demoState();

    members = [
      {
        user_id:
          user.id,
        role:
          "owner",
        profile:
          s.users.find(
            u =>
              u.id === user.id
          )
      },

      ...s.members
        .filter(
          m =>
            m.list_id ===
            active.id
        )
        .map(m => ({
          user_id:
            m.user_id,
          role:
            m.role,
          profile:
            s.users.find(
              u =>
                u.id ===
                m.user_id
            )
        }))
    ];

  } else {

    const result =
      await sb
        .from("list_members")
        .select(
          "user_id,role,profiles(id,display_name)"
        )
        .eq(
          "list_id",
          active.id
        );

    if (result.error) {
      throw result.error;
    }

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
              type="email"
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
        : ""
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
          .join("")
      }
    </div>
  `);

  if (canManage()) {

    $("inviteBtn").onclick =
      inviteMember;

    document
      .querySelectorAll(
        "[data-member-role]"
      )
      .forEach(select => {

        select.onchange =
          () =>
            changeRole(
              select.dataset.memberRole,
              select.value
            );

      });

  }
}

function memberHtml(m) {

  const name =
    m.profile?.display_name ||
    m.profile?.username ||
    m.user_id?.slice(
      0,
      8
    ) ||
    "کاربر";

  return `
    <div class="member">

      <div class="member-main">

        <div class="mini-avatar">
          ${esc(
            name?.[0] ||
            "U"
          )}
        </div>

        <div>

          <div class="member-name">
            ${esc(name)}
            ${
              m.user_id === user?.id
                ? "(شما)"
                : ""
            }
          </div>

          <!-- ایمیل عمداً نمایش داده نمی‌شود -->

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
                  m.role === "editor"
                    ? "selected"
                    : ""
                }
              >
                ویرایشگر
              </option>

              <option
                value="viewer"
                ${
                  m.role === "viewer"
                    ? "selected"
                    : ""
                }
              >
                فقط مشاهده
              </option>

              <option
                value="admin"
                ${
                  m.role === "admin"
                    ? "selected"
                    : ""
                }
              >
                مدیر
              </option>

            </select>
          `

          : `
            <span class="role-select">
              ${
                m.role === "owner"
                  ? "مالک"
                  : m.role === "admin"
                    ? "مدیر"
                    : m.role === "editor"
                      ? "ویرایشگر"
                      : "مشاهده"
              }
            </span>
          `
      }

    </div>
  `;
}

async function inviteMember() {

  const input =
    $("inviteEmail");

  if (!input) return;

  const email =
    input.value
      .trim()
      .toLowerCase();

  if (!email) {
    return toast(
      "ایمیل را وارد کن"
    );
  }

  try {

    if (user?._demo) {

      let s =
        demoState();

      const u =
        s.users.find(
          x =>
            x.email === email
        );

      if (!u) {
        throw Error(
          "این کاربر هنوز حساب نساخته است."
        );
      }

      if (
        s.members.some(
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
          "این کاربر از قبل عضو است."
        );
      }

      s.members.push({
        list_id:
          active.id,
        user_id:
          u.id,
        role:
          "editor"
      });

      saveDemo(s);

    } else {

      const result =
        await sb.rpc(
          "add_list_member_by_email",
          {
            p_list_id:
              active.id,
            p_email:
              email,
            p_role:
              "editor"
          }
        );

      if (result.error) {
        throw result.error;
      }

    }

    toast(
      "عضو اضافه شد"
    );

    await membersModal();

  } catch (e) {

    toast(
      e.message ||
      "خطا در افزودن عضو"
    );

  }
}

async function changeRole(
  uid,
  role
) {

  try {

    if (user?._demo) {

      let s =
        demoState();

      const member =
        s.members.find(
          x =>
            x.list_id ===
              active.id &&
            x.user_id ===
              uid
        );

      if (member) {
        member.role =
          role;
      }

      saveDemo(s);

    } else {

      const result =
        await sb
          .from("list_members")
          .update({
            role
          })
          .eq(
            "list_id",
            active.id
          )
          .eq(
            "user_id",
            uid
          );

      if (result.error) {
        throw result.error;
      }

    }

    toast(
      "سطح دسترسی تغییر کرد"
    );

  } catch (e) {

    toast(
      e.message ||
      "خطا"
    );

  }
}


/* =========================================================
   ADMIN
========================================================= */

async function adminModal() {

  if (!user) return;

  let users = [];

  if (user?._demo) {

    users =
      demoState().users;

  } else {

    const result =
      await sb
        .from("profiles")
        .select(
          "id,username,display_name,created_at"
        )
        .order(
          "created_at",
          {
            ascending:
              false
          }
        );

    if (result.error) {
      throw result.error;
    }

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
                        "U"
                      )[0]
                    )}
                  </div>

                  <div>

                    <div class="member-name">
                      ${esc(
                        u.display_name ||
                        u.username ||
                        "کاربر"
                      )}

                      ${
                        u.id === user.id
                          ? " (شما)"
                          : ""
                      }
                    </div>

                    <!-- ایمیل عمداً نمایش داده نمی‌شود -->

                  </div>

                </div>

                <span class="role-select">
                  ${
                    u.id === user.id
                      ? "حساب شما"
                      : "کاربر"
                  }
                </span>

              </div>
            `
          )
          .join("")
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
  ) {
    return;
  }

  if (channel) {
    sb.removeChannel(
      channel
    );
  }

  channel =
    sb
      .channel(
        "hesamlist-" +
        active.id
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "items",
          filter:
            "list_id=eq." +
            active.id
        },
        async () => {

          try {

            await cloudItems();

            renderItems();
            renderDashboard();

          } catch (e) {

            console.error(e);

          }

        }
      )
      .subscribe();
}


/* =========================================================
   START CLOUD
========================================================= */

async function bootCloud() {

  if (
    !hasCloud()
  ) {
    bootDemo();
    return;
  }

  if (
    typeof supabase ===
    "undefined"
  ) {

    console.error(
      "Supabase library not loaded."
    );

    msg(
      "کتابخانه Supabase بارگذاری نشده است."
    );

    return;
  }

  sb =
    supabase.createClient(
      C.supabaseUrl,
      C.supabaseAnonKey
    );

  const {
    data
  } =
    await sb.auth.getSession();

  if (
    data?.session
  ) {

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

      if (session) {

        user =
          session.user;

        await startApp();

      } else {

        user = null;
        profile = null;

        showAuth();

      }

    }
  );
}


/* =========================================================
   START APP
========================================================= */

async function startApp() {

  if (!user) {
    return;
  }

  showApp();

  /*
    دریافت پروفایل
  */

  if (!user._demo) {
    await loadProfile();
  }

  /*
    نام کاربر
    ایمیل عمداً اینجا نمایش داده نمی‌شود.
  */

  if ($("userName")) {
    $("userName").textContent =
      currentName();
  }

  if ($("userEmail")) {

    /*
      ایمیل داخلی حذف شد
    */

    $("userEmail").textContent =
      "";

    $("userEmail").classList.add(
      "hidden"
    );

  }

  if ($("avatar")) {

    $("avatar").textContent =
      currentName()
        .trim()
        .charAt(0)
        .toUpperCase() ||
      "H";

  }

  if ($("adminBtn")) {

    $("adminBtn")
      .classList
      .toggle(
        "hidden",
        !user?._demo &&
        user?.user_metadata
          ?.is_super_admin !== true
      );

  }

  try {

    await loadData();

  } catch (e) {

    console.error(e);

    toast(
      e.message ||
      "خطا در دریافت اطلاعات"
    );

  }
}


/* =========================================================
   DEMO BOOT
========================================================= */

function bootDemo() {

  const sid =
    localStorage.getItem(
      "hesamlist_session"
    );

  if (sid) {

    const s =
      demoState();

    const u =
      s.users.find(
        x =>
          x.id === sid
      );

    if (u) {

      user = {
        id: u.id,
        email: "",
        user_metadata: {
          username:
            u.username,
          display_name:
            u.name
        },
        _demo: true
      };

      profile = {
        id: u.id,
        username:
          u.username,
        display_name:
          u.name
      };

      startApp();

      return;
    }
  }

  showAuth();

  if ($("syncText")) {
    $("syncText").textContent =
      "حالت آزمایشی محلی";
  }
}


/* =========================================================
   AUTH FORM
========================================================= */

if ($("authForm")) {

  $("authForm").onsubmit =
    async e => {

      e.preventDefault();

      const username =
        $("username")
          ?.value
          ?.trim()
          ?.toLowerCase() ||
        "";

      const password =
        $("password")
          ?.value ||
        "";

      const name =
        $("displayName")
          ?.value
          ?.trim() ||
        "";

      try {

        if (!username) {
          throw Error(
            "نام کاربری را وارد کن."
          );
        }

        if (!password) {
          throw Error(
            "رمز عبور را وارد کن."
          );
        }

        /*
          CLOUD
        */

        if (hasCloud()) {

          if (!sb) {

            sb =
              supabase.createClient(
                C.supabaseUrl,
                C.supabaseAnonKey
              );

          }

          if (
            authMode ===
            "signup"
          ) {

            if (!name) {
              throw Error(
                "نام و نام خانوادگی را وارد کن."
              );
            }

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
                "حساب ساخته شد. اگر تأیید ایمیل فعال است، باید Email Confirmation را در Supabase خاموش کنیم.",
                true
              );

              return;
            }

            user =
              result.user;

            toast(
              "حساب ساخته شد"
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
              "خوش آمدی"
            );

            await startApp();

          }

        }

        /*
          DEMO
        */

        else {

          demoLogin(
            username,
            name,
            authMode ===
              "signup",
            password
          );

          await startApp();

          toast(
            "وارد شدید"
          );

        }

      } catch (e) {

        console.error(
          e
        );

        msg(
          e.message ||
          "عملیات ناموفق بود"
        );

      }

    };

}


/* =========================================================
   AUTH TABS
========================================================= */

document
  .querySelectorAll(
    "[data-auth]"
  )
  .forEach(btn => {

    btn.onclick = () => {

      authMode =
        btn.dataset.auth;

      document
        .querySelectorAll(
          "[data-auth]"
        )
        .forEach(x =>
          x.classList.toggle(
            "active",
            x === btn
          )
        );

      $("nameField")
        ?.classList
        .toggle(
          "hidden",
          authMode !==
            "signup"
        );

      if ($("authTitle")) {

        $("authTitle")
          .textContent =
          authMode ===
          "signup"
            ? "حساب خودت را بساز و دوستانت را اضافه کن."
            : "همه‌چیز برای سفر و خرید، یک‌جا.";

      }

      if ($("authSubmit")) {

        $("authSubmit")
          .innerHTML =
          authMode ===
          "signup"
            ? "ساخت حساب <span>←</span>"
            : "ورود به HesamList <span>←</span>";

      }

      if ($("password")) {
        $("password").value =
          "";
      }

      msg("");

    };

  });


/* =========================================================
   BUTTONS
========================================================= */

$("newListBtn") &&
  ($("newListBtn").onclick =
    createList);

$("sidebarNew") &&
  ($("sidebarNew").onclick =
    createList);

$("welcomeNew") &&
  ($("welcomeNew").onclick =
    createList);

$("addItemBtn") &&
  ($("addItemBtn").onclick =
    addItem);

$("itemInput") &&
  ($("itemInput").onkeydown =
    e => {

      if (
        e.key ===
        "Enter"
      ) {
        addItem();
      }

    });

$("membersBtn") &&
  ($("membersBtn").onclick =
    membersModal);

$("deleteListBtn") &&
  ($("deleteListBtn").onclick =
    deleteList);

$("adminBtn") &&
  ($("adminBtn").onclick =
    adminModal);

$("closeModal") &&
  ($("closeModal").onclick =
    closeModal);

$("modal") &&
  ($("modal").onclick =
    e => {

      if (
        e.target ===
        $("modal")
      ) {
        closeModal();
      }

    });

$("mobileMenu") &&
  ($("mobileMenu").onclick =
    () =>
      $("sidebar")
        ?.classList
        .toggle(
          "open"
        ));

$("allListsBtn") &&
  ($("allListsBtn").onclick =
    showDashboard);


/* =========================================================
   FILTERS
========================================================= */

document
  .querySelectorAll(
    ".filter"
  )
  .forEach(btn => {

    btn.onclick = () => {

      filter =
        btn.dataset.filter;

      document
        .querySelectorAll(
          ".filter"
        )
        .forEach(x =>
          x.classList.toggle(
            "active",
            x === btn
          )
        );

      renderItems();

    };

  });


/* =========================================================
   OPTIONAL BUTTONS
   فقط اگر توابعشان در پروژه وجود داشته باشند
========================================================= */

if (
  typeof createGroup ===
  "function"
) {

  $("newGroupBtn") &&
    ($("newGroupBtn").onclick =
      createGroup);

  $("welcomeGroup") &&
    ($("welcomeGroup").onclick =
      createGroup);

}

if (
  typeof groupsModal ===
  "function"
) {

  $("dashboardGroupsBtn") &&
    ($("dashboardGroupsBtn").onclick =
      groupsModal);

}

if (
  typeof changeListImage ===
  "function"
) {

  $("changeListImageBtn") &&
    ($("changeListImageBtn").onclick =
      changeListImage);

}


/* =========================================================
   LOGOUT
========================================================= */

$("logoutBtn") &&
  ($("logoutBtn").onclick =
    async () => {

      try {

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
        "hesamlist_session"
      );

      user = null;
      profile = null;
      lists = [];
      active = null;
      items = [];
      channel = null;

      showAuth();

      toast(
        "از حساب خارج شدید"
      );

    });


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

    console.error(
      "BOOT ERROR:",
      e
    );

    msg(
      e.message ||
      "خطا در اجرای برنامه"
    );

  }

})();
