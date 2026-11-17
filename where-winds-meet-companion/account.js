(function(){
  const cfg=window.WWM_SUPABASE_CONFIG||{};
  let client=null,user=null,cloudReady=false,queue=Promise.resolve();
  if(window.supabase&&window.supabase.createClient&&cfg.url&&cfg.anonKey&&!cfg.url.includes("YOUR_")&&!cfg.anonKey.includes("YOUR_")){
    client=window.supabase.createClient(cfg.url,cfg.anonKey);
  }
  function esc(value){return String(value).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
  function message(text){const el=document.querySelector("#auth-message");if(el)el.textContent=text;}
  function view(){
    if(!client)return '<div class="card"><span class="tag">COMPTE COMPAGNON</span><h2 style="margin:14px 0">Connexion cloud à configurer</h2><p class="muted small">L’interface de compte est prête, mais le service Supabase n’est pas encore configuré. Aucun compte n’est créé à ce stade.</p><div class="notice">Pour activer l’inscription : créer un projet Supabase, appliquer <code>supabase/schema.sql</code>, puis renseigner l’URL du projet et sa clé publishable dans <code>supabase-config.js</code>. Ne jamais utiliser la clé secrète service_role dans le navigateur.</div><p class="small muted">Les données restent enregistrées localement et peuvent être exportées avec le bouton ⇩.</p></div>';
    if(!user)return '<div class="card"><span class="tag">COMPTE COMPAGNON</span><h2 style="margin:14px 0">Retrouve ton aventure partout</h2><p class="muted small">Crée un compte indépendant de ton compte Where Winds Meet. Il synchronisera tes quêtes, découvertes, builds et notes entre tes appareils.</p><form id="auth-form"><label class="small muted">Adresse e-mail</label><input class="field" type="email" name="email" autocomplete="email" required style="margin:6px 0 12px"><label class="small muted">Mot de passe</label><input class="field" type="password" name="password" minlength="8" autocomplete="current-password" required style="margin:6px 0 12px"><div class="action-row"><button class="btn primary" type="submit" name="mode" value="signin">Se connecter</button><button class="btn" type="submit" name="mode" value="signup">Créer mon compte</button></div></form><button class="text-action" type="button" id="forgot-password">Mot de passe oublié ?</button><p class="small muted" id="auth-message" aria-live="polite">Mot de passe de 8 caractères minimum. La vérification e-mail dépendra des réglages du service.</p></div>';
    return '<div class="card"><span class="tag">COMPTE CONNECTÉ</span><h2 style="margin:14px 0">'+esc(user.email||"Joueur connecté")+'</h2><p class="muted small">Ton compte compagnon est connecté. Synchronise tes données pour les retrouver sur tes autres appareils.</p><div class="action-row"><button class="btn primary" id="sync-now">Synchroniser maintenant</button><button class="btn" id="sign-out">Se déconnecter</button></div><p class="small muted" id="auth-message" aria-live="polite">'+(cloudReady?"Synchronisation active.":"Connecté — première synchronisation à effectuer.")+'</p></div>';
  }
  function merge(local,remote){
    const quests=new Map();
    (remote.quests||[]).concat(local.quests||[]).forEach(function(q){const k=String(q.name||"").trim().toLowerCase();if(!k)return;const p=quests.get(k);quests.set(k,Object.assign({},p||{},q,{done:!!((p&&p.done)||q.done)}));});
    const journal=new Map();
    (remote.journal||[]).concat(local.journal||[]).forEach(function(j){journal.set(String(j.date||"")+"|"+String(j.note||""),j);});
    const builds=new Map();
    (remote.builds||[]).concat(local.builds||[]).forEach(function(b){builds.set(String(b.name||"")+"|"+String(b.details||""),b);});
    const checks=Object.assign({},remote.checks||{},local.checks||{});
    Object.keys(checks).forEach(function(k){checks[k]=!!((remote.checks||{})[k]||(local.checks||{})[k]);});
    return {quests:Array.from(quests.values()),journal:Array.from(journal.values()),checks:checks,builds:Array.from(builds.values())};
  }
  async function sync(){
    if(!client||!user)return;
    message("Synchronisation en cours…");cloudReady=false;
    const api=window.wwmDataApi;const local=api.getData();
    const read=await client.from("companion_state").select("payload").eq("user_id",user.id).maybeSingle();
    if(read.error){message("Erreur de lecture : "+read.error.message);return;}
    const combined=merge(local,read.data&&read.data.payload||{});
    api.setData(combined);api.saveLocal();
    const write=await client.from("companion_state").upsert({user_id:user.id,schema_version:1,payload:combined},{onConflict:"user_id"});
    if(write.error){message("Erreur d’enregistrement : "+write.error.message);return;}
    cloudReady=true;message("Synchronisation terminée. Tes données sont enregistrées sur ton compte.");
    const state=document.querySelector("#save-state");if(state)state.textContent="● Synchronisation activée";
  }
  window.wwmAccountView=view;
  window.wwmAccountBind=function(root){
    if(!client)return;
    const form=root.querySelector("#auth-form");
    if(form)form.onsubmit=async function(e){
      e.preventDefault();const mode=e.submitter&&e.submitter.value||"signin";
      const email=form.email.value.trim(),password=form.password.value;message("Connexion en cours…");
      const result=mode==="signup"?await client.auth.signUp({email:email,password:password}):await client.auth.signInWithPassword({email:email,password:password});
      if(result.error){message(result.error.message);return;}
      if(mode==="signup"&&!result.data.session){message("Compte créé. Vérifie ton e-mail pour confirmer l’inscription, puis connecte-toi.");return;}
      user=result.data.user||result.data.session&&result.data.session.user||null;
      window.wwmDataApi.render("account");
    };
    const forgot=root.querySelector("#forgot-password");if(forgot)forgot.onclick=async function(){const form=root.querySelector("#auth-form");const email=form.email.value.trim();if(!email){message("Saisis ton adresse e-mail avant de demander un lien de réinitialisation.");return;}const result=await client.auth.resetPasswordForEmail(email);message(result.error?"Erreur : "+result.error.message:"Si un compte correspond à cette adresse, un e-mail de réinitialisation va être envoyé.");};
    const syncButton=root.querySelector("#sync-now");if(syncButton)syncButton.onclick=function(){sync().catch(function(e){message("Erreur de synchronisation : "+e.message);});};
    const out=root.querySelector("#sign-out");if(out)out.onclick=async function(){const result=await client.auth.signOut();if(result.error){message(result.error.message);return;}user=null;cloudReady=false;window.wwmDataApi.render("account");};
  };
  window.wwmCloudSave=function(payload){
    if(!client||!user||!cloudReady)return;
    queue=queue.then(async function(){const result=await client.from("companion_state").upsert({user_id:user.id,schema_version:1,payload:payload},{onConflict:"user_id"});if(result.error)throw result.error;}).catch(function(error){console.error("Cloud sync failed",error);const state=document.querySelector("#save-state");if(state)state.textContent="● Erreur de synchronisation";});
  };
  if(client){
    client.auth.getSession().then(function(result){user=result.data.session&&result.data.session.user||null;const state=document.querySelector("#save-state");if(state&&user)state.textContent="● Compte connecté";});
    client.auth.onAuthStateChange(function(_event,session){user=session&&session.user||null;cloudReady=false;const state=document.querySelector("#save-state");if(state)state.textContent=user?"● Compte connecté":"● Sauvegarde locale";if(window.wwmDataApi&&window.wwmDataApi.getView()==="account")window.wwmDataApi.render("account");});
  }
})();