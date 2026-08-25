const C=window.HESAMLIST_CONFIG||{};const hasCloud=()=>!!(C.supabaseUrl&&!C.supabaseUrl.includes('PASTE_')&&C.supabaseAnonKey&&!C.supabaseAnonKey.includes('PASTE_'));
let sb=null,user=null,lists=[],active=null,items=[],filter='all',authMode='login',channel=null;
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


 async function signup(username, password, name) {

  if (!sb) {
    sb = supabase.createClient(
      C.supabaseUrl,
      C.supabaseAnonKey
    );
  }

  const clean = username.trim().toLowerCase();

  if (!/^[a-z0-9_]{3,30}$/.test(clean)) {
    throw Error(
      'نام کاربری باید ۳ تا ۳۰ کاراکتر و فقط شامل حروف انگلیسی، عدد و _ باشد.'
    );
  }

  const email = internalEmail(clean);

  const { data, error } =
    await sb.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          username: clean,
          display_name: name || clean
        }
      }
    });

  if (error) {
    throw error;
  }

  if (data.user) {

    await sb
      .from('profiles')
      .upsert({
        id: data.user.id,
        username: clean,
        display_name: name || clean
      });

  }

  return data;
}
        }
      }
    });

  if (error) throw error;

  if (data.user) {

    const { error: profileError } =
      await sb
        .from('profiles')
        .upsert({
          id: data.user.id,
          username: clean,
          display_name: name || clean
        });

    if (profileError) {
      console.error(profileError);
    }
  }

  return data;
}


async function login(username, password) {

  const clean = username.trim().toLowerCase();

  const { data, error } =
    await sb.rpc(
      'get_auth_email_by_username',
      {
        p_username: clean
      }
    );

  if (error) throw error;

  const email =
    Array.isArray(data)
      ? data[0]
      : data;

  if (!email) {
    throw Error(
      'نام کاربری یا رمز عبور اشتباه است.'
    );
  }

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
const $=id=>document.getElementById(id);const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const iconFor=t=>t==='shopping'?'🛒':'✈️';const roleRank={viewer:1,editor:2,admin:3,owner:4};
function toast(t){const x=$('toast');x.textContent=t;x.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>x.classList.remove('show'),2600)}
function msg(t,ok=false){$('authMessage').textContent=t;$('authMessage').style.color=ok?'var(--green)':'var(--red)'}
function openModal(html){$('modalContent').innerHTML=html;$('modal').classList.remove('hidden')}function closeModal(){$('modal').classList.add('hidden')}
function showAuth(){ $('authView').classList.remove('hidden');$('appView').classList.add('hidden') }function showApp(){ $('authView').classList.add('hidden');$('appView').classList.remove('hidden') }
function currentName(){return user?.user_metadata?.display_name||user?.email?.split('@')[0]||'کاربر'}
function roleOf(){return active?.my_role|| (active?.owner_id===user?.id?'owner':'viewer')}
function canEdit(){return roleRank[roleOf()]>=2}function canManage(){return roleRank[roleOf()]>=3}
function localKey(){return 'hesamlist_demo_v3'}
function demoState(){try{return JSON.parse(localStorage.getItem(localKey()))||{users:[],lists:[],items:[],members:[]}}catch{return {users:[],lists:[],items:[],members:[]}}}
function saveDemo(s){localStorage.setItem(localKey(),JSON.stringify(s))}
function demoLogin(email,name,signup){let s=demoState();let u=s.users.find(x=>x.email===email);if(signup){if(u)throw Error('این ایمیل قبلاً ثبت شده است.');u={id:crypto.randomUUID(),email,name:name||email.split('@')[0],password:$('password').value};s.users.push(u);if(!s.adminId)s.adminId=u.id}else{if(!u||u.password!==$('password').value)throw Error('ایمیل یا رمز عبور اشتباه است.')}user={id:u.id,email:u.email,user_metadata:{display_name:u.name},_demo:true};localStorage.setItem('hesamlist_session',u.id);saveDemo(s)}
function demoLists(){let s=demoState();lists=s.lists.filter(l=>l.owner_id===user.id||s.members.some(m=>m.list_id===l.id&&m.user_id===user.id)).map(l=>({...l,my_role:l.owner_id===user.id?'owner':s.members.find(m=>m.list_id===l.id&&m.user_id===user.id)?.role||'viewer'}));}
function demoItems(){let s=demoState();items=s.items.filter(i=>i.list_id===active.id)}
function demoCreateList(title,type){let s=demoState();let l={id:crypto.randomUUID(),title,type,owner_id:user.id,created_at:new Date().toISOString()};s.lists.push(l);saveDemo(s);return l}
function demoAddItem(name){let s=demoState();s.items.push({id:crypto.randomUUID(),list_id:active.id,name,done:false,created_by:user.id,created_at:new Date().toISOString()});saveDemo(s)}
function demoUpdateItem(id,done){let s=demoState();let i=s.items.find(x=>x.id===id);if(i)i.done=done;saveDemo(s)}
function demoDeleteItem(id){let s=demoState();s.items=s.items.filter(x=>x.id!==id);saveDemo(s)}
async function cloudLists(){const {data,error}=await sb.from('lists').select('*').order('created_at',{ascending:false});if(error)throw error;const ids=(data||[]).map(x=>x.id);let roles={};if(ids.length){const r=await sb.from('list_members').select('list_id,role').eq('user_id',user.id).in('list_id',ids);(r.data||[]).forEach(x=>roles[x.list_id]=x.role)}lists=(data||[]).map(l=>({...l,my_role:l.owner_id===user.id?'owner':roles[l.id]||'viewer'}));}
async function cloudItems(){const {data,error}=await sb.from('items').select('*').eq('list_id',active.id).order('created_at',{ascending:true});if(error)throw error;items=data||[]}
async function loadData(){if(user?._demo)demoLists();else await cloudLists();renderNav();renderDashboard();if(active&&lists.some(x=>x.id===active.id))await selectList(active.id);else{active=null;showDashboard()};}
function renderNav(){$('listCount').textContent=lists.length;$('listNav').innerHTML=lists.length?lists.map(l=>`<button class="nav-item ${active?.id===l.id?'active':''}" data-id="${l.id}"><span class="nav-type">${iconFor(l.type)}</span><span class="nav-name">${esc(l.title)}</span><span class="nav-badge">${roleRank[l.my_role]>=3?'مدیر':''}</span></button>`).join(''):'<div style="color:#9aa2b1;font-size:10px;padding:12px 5px">هنوز لیستی ندارید.</div>';document.querySelectorAll('.nav-item').forEach(b=>b.onclick=()=>{selectList(b.dataset.id);$('sidebar').classList.remove('open')})}
function renderDashboard(){let open=0,done=0;if(user?._demo){let s=demoState();const ids=new Set(lists.map(l=>l.id));const its=s.items.filter(i=>ids.has(i.list_id));open=its.filter(i=>!i.done).length;done=its.filter(i=>i.done).length}else{open=0;done=0} $('statLists').textContent=lists.length;$('statOpen').textContent=open;$('statDone').textContent=done;$('statMembers').textContent=lists.length?Math.max(1,new Set(lists.map(x=>x.owner_id)).size):0;$('welcomeName').textContent=currentName().split(' ')[0];$('dashboardLists').innerHTML=lists.map(l=>{let its=user?._demo?demoState().items.filter(i=>i.list_id===l.id):[];let d=its.filter(i=>i.done).length,p=its.length?Math.round(d/its.length*100):0;return `<div class="dash-card" data-dash="${l.id}"><div class="dash-top"><span class="dash-icon">${iconFor(l.type)}</span><div><h3>${esc(l.title)}</h3><small>${l.type==='shopping'?'لیست خرید':'وسایل سفر'} · ${its.length} مورد</small></div></div><div class="dash-progress"><div class="dash-progress-top"><span>پیشرفت</span><b>${p}%</b></div><div class="progress"><i style="width:${p}%"></i></div></div></div>`}).join('');document.querySelectorAll('[data-dash]').forEach(x=>x.onclick=()=>selectList(x.dataset.dash))}
function showDashboard(){$('dashboard').classList.remove('hidden');$('listView').classList.add('hidden');renderNav();renderDashboard()}
async function selectList(id){active=lists.find(x=>x.id===id);if(!active)return;filter='all';document.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x.dataset.filter==='all'));if(user?._demo)demoItems();else await cloudItems();$('dashboard').classList.add('hidden');$('listView').classList.remove('hidden');$('listTitle').textContent=active.title;$('listTypeLabel').textContent=active.type==='shopping'?'خرید':'سفر';$('listIcon').textContent=iconFor(active.type);renderNav();renderItems()}
function renderItems(){const all=items.length,done=items.filter(i=>i.done).length,open=all-done,p=all?Math.round(done/all*100):0;$('countAll').textContent=all;$('countOpen').textContent=open;$('countDone').textContent=done;$('progressText').textContent=p+'%';$('progressBar').style.width=p+'%';$('listMeta').textContent=`${all} مورد · ${done} مورد انجام شده`;$('listEmpty').classList.toggle('hidden',all!==0);let visible=filter==='open'?items.filter(i=>!i.done):filter==='done'?items.filter(i=>i.done):items;$('items').innerHTML=visible.map(i=>`<div class="item ${i.done?'done':''}"><button class="check ${i.done?'done':''}" data-check="${i.id}" ${canEdit()?'':'disabled'}>${i.done?'✓':''}</button><span class="item-name">${esc(i.name)}</span><span class="item-meta">${i.created_at?new Date(i.created_at).toLocaleDateString('fa-IR'):''}</span>${canEdit()?`<button class="item-delete" data-delete="${i.id}">حذف</button>`:''}</div>`).join('');document.querySelectorAll('[data-check]').forEach(b=>b.onclick=()=>toggleItem(b.dataset.check));document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>deleteItem(b.dataset.delete));$('addItemBtn').disabled=!canEdit();$('itemInput').disabled=!canEdit();$('itemInput').placeholder=canEdit()?'مثلاً پاسپورت، شارژر، آب...':'شما فقط دسترسی مشاهده دارید.'}
async function addItem(){const name=$('itemInput').value.trim();if(!name||!active||!canEdit())return;try{if(user._demo)demoAddItem(name);else{const {error}=await sb.from('items').insert({list_id:active.id,name,created_by:user.id});if(error)throw error} $('itemInput').value='';await refreshItems();toast('مورد اضافه شد')}catch(e){toast(e.message||'خطا در افزودن مورد')}}
async function refreshItems(){if(user._demo)demoItems();else await cloudItems();renderItems();renderDashboard()}
async function toggleItem(id){if(!canEdit())return;const i=items.find(x=>x.id===id);if(!i)return;try{if(user._demo)demoUpdateItem(id,!i.done);else{const {error}=await sb.from('items').update({done:!i.done}).eq('id',id);if(error)throw error}await refreshItems()}catch(e){toast(e.message||'خطا')}}
async function deleteItem(id){if(!canEdit())return;if(!confirm('این مورد حذف شود؟'))return;try{if(user._demo)demoDeleteItem(id);else{const {error}=await sb.from('items').delete().eq('id',id);if(error)throw error}await refreshItems();toast('مورد حذف شد')}catch(e){toast(e.message||'خطا')}}
async function createList(){openModal(`<h2>ساخت لیست جدید</h2><p class="modal-sub">نوع لیست را انتخاب کن؛ بعداً می‌توانی دوستانت را اضافه کنی.</p><div class="field"><label>نام لیست</label><input id="newTitle" placeholder="مثلاً سفر شمال ۱۴۰۵"></div><div class="type-grid"><button class="type-choice active" data-type="travel">✈️<b>وسایل سفر</b><small>چمدان، مدارک، لباس و...</small></button><button class="type-choice" data-type="shopping">🛒<b>خرید</b><small>خرید خانه، مهمانی و...</small></button></div><button id="createConfirm" class="btn primary wide">ساخت لیست</button>`);document.querySelectorAll('.type-choice').forEach(b=>b.onclick=()=>{document.querySelectorAll('.type-choice').forEach(x=>x.classList.remove('active'));b.classList.add('active')});$('createConfirm').onclick=async()=>{const title=$('newTitle').value.trim();const type=document.querySelector('.type-choice.active').dataset.type;if(!title)return toast('نام لیست را وارد کن');try{let l;if(user._demo){l=demoCreateList(title,type);demoLists()}else{const r=await sb.from('lists').insert({title,type,owner_id:user.id}).select().single();if(r.error)throw r.error;l=r.data}closeModal();await loadData();await selectList(l.id);toast('لیست ساخته شد')}catch(e){toast(e.message||'خطا در ساخت لیست')}}}
async function deleteList(){if(!active||!confirm(`لیست «${active.title}» حذف شود؟ این کار قابل بازگشت نیست.`))return;try{if(user._demo){let s=demoState();s.lists=s.lists.filter(x=>x.id!==active.id);s.items=s.items.filter(x=>x.list_id!==active.id);s.members=s.members.filter(x=>x.list_id!==active.id);saveDemo(s)}else{const r=await sb.from('lists').delete().eq('id',active.id);if(r.error)throw r.error}active=null;await loadData();toast('لیست حذف شد')}catch(e){toast(e.message||'خطا')}}
async function membersModal(){if(!active)return;let members=[];if(user._demo){let s=demoState();members=[{user_id:user.id,role:'owner',profile:s.users.find(u=>u.id===user.id)},{...s.members.filter(m=>m.list_id===active.id).map(m=>({user_id:m.user_id,role:m.role,profile:s.users.find(u=>u.id===m.user_id)}))}]}else{const r=await sb.from('list_members').select('user_id,role,profiles(id,display_name)').eq('list_id',active.id);if(r.error)throw r.error;members=r.data||[]}openModal(`<h2>اعضا و دسترسی</h2><p class="modal-sub">مالک و مدیر می‌توانند اعضا را اضافه یا سطح دسترسی آن‌ها را تغییر دهند.</p>${canManage()?`<div class="invite-row"><input id="inviteEmail" type="email" placeholder="ایمیل دوستت، مثلاً friend@example.com"><button id="inviteBtn" class="btn primary">افزودن</button></div>`:''}<div id="memberList" style="margin-top:15px">${members.map(m=>memberHtml(m)).join('')}</div>`);if(canManage())$('inviteBtn').onclick=()=>inviteMember();document.querySelectorAll('[data-member-role]').forEach(s=>s.onchange=()=>changeRole(s.dataset.memberRole,s.value))}
function memberHtml(m){const name=m.profile?.display_name||m.profile?.email||m.user_id?.slice(0,8);const email=m.profile?.email||'';return `<div class="member"><div class="member-main"><div class="mini-avatar">${esc(name?.[0]||'U')}</div><div><div class="member-name">${esc(name)} ${m.user_id===user.id?'(شما)':''}</div><div class="member-email">${esc(email)}</div></div></div>${canManage()&&m.user_id!==active.owner_id?`<select class="role-select" data-member-role="${m.user_id}"><option value="editor" ${m.role==='editor'?'selected':''}>ویرایشگر</option><option value="viewer" ${m.role==='viewer'?'selected':''}>فقط مشاهده</option><option value="admin" ${m.role==='admin'?'selected':''}>مدیر</option></select>`:`<span class="role-select">${m.role==='owner'?'مالک':m.role==='admin'?'مدیر':m.role==='editor'?'ویرایشگر':'مشاهده'}</span>`}</div>`}
async function inviteMember(){const email=$('inviteEmail').value.trim().toLowerCase();if(!email)return toast('ایمیل را وارد کن');try{if(user._demo){let s=demoState();let u=s.users.find(x=>x.email===email);if(!u)throw Error('در نسخه آزمایشی، دوستت باید اول با همین ایمیل یک حساب بسازد.');if(s.members.some(m=>m.list_id===active.id&&m.user_id===u.id)||u.id===active.owner_id)throw Error('این کاربر از قبل عضو است.');s.members.push({list_id:active.id,user_id:u.id,role:'editor'});saveDemo(s)}else{const r=await sb.rpc('add_list_member_by_email',{p_list_id:active.id,p_email:email,p_role:'editor'});if(r.error)throw r.error}toast('عضو اضافه شد');await membersModal()}catch(e){toast(e.message||'خطا در افزودن عضو')}}
async function changeRole(uid,role){try{if(user._demo){let s=demoState();let m=s.members.find(x=>x.list_id===active.id&&x.user_id===uid);if(m)m.role=role;saveDemo(s)}else{const r=await sb.from('list_members').update({role}).eq('list_id',active.id).eq('user_id',uid);if(r.error)throw r.error}toast('سطح دسترسی تغییر کرد')}catch(e){toast(e.message||'خطا')}}
async function adminModal(){if(!user)return;let users=[];if(user._demo){users=demoState().users}else{const r=await sb.from('profiles').select('id,display_name,created_at').order('created_at',{ascending:false});if(r.error)throw r.error;users=r.data||[]}openModal(`<h2>مدیریت کاربران</h2><p class="modal-sub">مدیر اصلی می‌تواند کاربران سامانه را مشاهده و کنترل کند. مدیریت دسترسی هر لیست از بخش «اعضا و دسترسی» انجام می‌شود.</p><div>${users.map(u=>`<div class="member"><div class="member-main"><div class="mini-avatar">${esc((u.display_name||'U')[0])}</div><div><div class="member-name">${esc(u.display_name||'کاربر')}</div><div class="member-email">${esc(u.email||'')}</div></div></div><span class="role-select">${u.id===user.id?'حساب شما':'کاربر'}</span></div>`).join('')}</div>`)}
function subscribe(){if(user?._demo||!sb||!active)return;if(channel)sb.removeChannel(channel);channel=sb.channel('hesamlist-'+active.id).on('postgres_changes',{event:'*',schema:'public',table:'items',filter:'list_id=eq.'+active.id},async()=>{await cloudItems();renderItems();renderDashboard()}).subscribe()}
async function bootCloud(){sb=supabase.createClient(C.supabaseUrl,C.supabaseAnonKey);const {data}=await sb.auth.getSession();if(data.session){user=data.session.user;await startApp()}else showAuth();sb.auth.onAuthStateChange(async(_,session)=>{if(session){user=session.user;await startApp()}else{user=null;showAuth()}})}
async function startApp(){showApp();$('userName').textContent=currentName();$('userEmail').textContent=user.email||'';$('avatar').textContent=currentName()[0]?.toUpperCase()||'H';$('adminBtn').classList.toggle('hidden',user.user_metadata?.is_super_admin!==true&&!user._demo);try{await loadData()}catch(e){toast(e.message||'خطا در دریافت اطلاعات')} }
function bootDemo(){let sid=localStorage.getItem('hesamlist_session');if(sid){let s=demoState(),u=s.users.find(x=>x.id===sid);if(u){user={id:u.id,email:u.email,user_metadata:{display_name:u.name},_demo:true};startApp();return}}showAuth();$('syncText').textContent='حالت آزمایشی محلی'}
$('authForm').onsubmit = async e => {

  e.preventDefault();

  const username =
    $('username').value.trim().toLowerCase();

  const password =
    $('password').value;

  const name =
    $('displayName')?.value?.trim() || '';

  try {

    if (!hasCloud()) {
      throw Error('اتصال Supabase تنظیم نشده است.');
    }

    if (!username) {
      throw Error('نام کاربری را وارد کن.');
    }

    if (!password) {
      throw Error('رمز عبور را وارد کن.');
    }

    if (authMode === 'signup') {

      if (!name) {
        throw Error('نام و نام خانوادگی را وارد کن.');
      }

      const result =
        await signup(
          username,
          password,
          name
        );

      if (!result.session) {

        msg(
          'حساب ساخته شد. اگر تأیید ایمیل در Supabase فعال است، باید آن را خاموش کنیم.',
          true
        );

        return;
      }

      toast('حساب ساخته شد');

      user = result.user;

      await startApp();

    } else {

      const result =
        await login(
          username,
          password
        );

      toast('خوش آمدی');

      user = result.data.user;

      await startApp();

    }

  } catch (e) {

    console.error(e);

    msg(
      e.message ||
      'عملیات ناموفق بود'
    );

  }

};


document
  .querySelectorAll('[data-auth]')
  .forEach(btn => {

    btn.onclick = () => {

      authMode = btn.dataset.auth;

      document
        .querySelectorAll('[data-auth]')
        .forEach(x =>
          x.classList.toggle(
            'active',
            x === btn
          )
        );

      $('nameField')
        .classList
        .toggle(
          'hidden',
          authMode !== 'signup'
        );

      $('authTitle').textContent =
        authMode === 'signup'
          ? 'حساب خودت را بساز و دوستانت را اضافه کن.'
          : 'همه‌چیز برای سفر و خرید، یک‌جا.';

      $('authSubmit').innerHTML =
        authMode === 'signup'
          ? 'ساخت حساب <span>←</span>'
          : 'ورود به HesamList <span>←</span>';

      $('password').value = '';

      msg('');

    };

  });


$('newGroupBtn').onclick = createGroup;

$('welcomeGroup').onclick = createGroup;

$('dashboardGroupsBtn').onclick = groupsModal;

$('newListBtn').onclick = createList;

$('sidebarNew').onclick = createList;

$('welcomeNew').onclick = createList;

$('addItemBtn').onclick = addItem;

$('itemInput').onkeydown = e => {

  if (e.key === 'Enter') {
    addItem();
  }

};

$('membersBtn').onclick = membersModal;

$('deleteListBtn').onclick = deleteList;

$('changeListImageBtn').onclick = changeListImage;

$('adminBtn').onclick = adminModal;

$('closeModal').onclick = closeModal;

$('modal').onclick = e => {

  if (e.target === $('modal')) {
    closeModal();
  }

};

$('mobileMenu').onclick = () =>
  $('sidebar').classList.toggle('open');

$('allListsBtn').onclick = showDashboard;


document
  .querySelectorAll('.filter')
  .forEach(btn => {

    btn.onclick = () => {

      filter = btn.dataset.filter;

      document
        .querySelectorAll('.filter')
        .forEach(x =>
          x.classList.toggle(
            'active',
            x === btn
          )
        );

      renderItems();

    };

  });


$('logoutBtn').onclick = async () => {

  try {

    if (sb) {
      await sb.auth.signOut();
    }

  } catch {}

  user = null;
  profile = null;
  groups = [];
  lists = [];
  active = null;
  items = [];

  showAuth();

  toast('از حساب خارج شدید');

};


(async () => {

  if (hasCloud()) {
    await bootCloud();
  } else {
    bootDemo();
  }

})();
