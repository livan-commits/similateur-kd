(function(){
  const cfg=window.WWM_SUPABASE_CONFIG||{};
  let client=null,user=null,cloudReady=false,recoveryMode=false,syncInFlight=false,cloudRevision=null,queue=Promise.resolve();
  if(window.supabase&&window.supabase.createClient&&cfg.url&&cfg.anonKey&&!cfg.url.includes("YOUR_")&&!cfg.anonKey.includes("YOUR_")){
    client=window.supabase.createClient(cfg.url,cfg.anonKey);
  }
  function esc(value){return String(value).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
  function message(text){const el=document.querySelector("#auth-message");if(el)el.textContent=text;}
  function view(){
    if(!client)return '<div class="card"><span class="tag">COMPTE COMPAGNON</span><h2 style="margin:14px 0">Connexion cloud à configurer</h2><p class="muted small">L’interface de compte est prête, mais le service Supabase n’est pas encore configuré. Aucun compte n’est créé à ce stade.</p><div class="notice">Pour activer l’inscription : créer un projet Supabase, appliquer <code>supabase/schema.sql</code>, puis renseigner l’URL du projet et sa clé publishable dans <code>supabase-config.js</code>. Ne jamais utiliser la clé secrète service_role dans le navigateur.</div><p class="small muted">Les données restent enregistrées localement et peuvent être exportées avec le bouton ⇩.</p></div>';
    if(recoveryMode&&user)return '<div class="card"><span class="tag">RÉINITIALISATION</span><h2 style="margin:14px 0">Choisir un nouveau mot de passe</h2><form id="recovery-form"><label class="small muted">Nouveau mot de passe</label><input class="field" type="password" name="password" minlength="8" autocomplete="new-password" required style="margin:6px 0 12px"><button class="btn primary" type="submit">Enregistrer le nouveau mot de passe</button></form><p class="small muted" id="auth-message" aria-live="polite">Choisis un mot de passe de 8 caractères minimum.</p></div>';
    if(!user)return '<div class="card"><span class="tag">COMPTE COMPAGNON</span><h2 style="margin:14px 0">Retrouve ton aventure partout</h2><p class="muted small">Crée un compte indépendant de ton compte Where Winds Meet. Il synchronisera tes quêtes, découvertes, builds et notes entre tes appareils.</p><form id="auth-form"><label class="small muted">Adresse e-mail</label><input class="field" type="email" name="email" autocomplete="email" required style="margin:6px 0 12px"><label class="small muted">Mot de passe</label><input class="field" type="password" name="password" minlength="8" autocomplete="current-password" required style="margin:6px 0 12px"><div class="action-row"><button class="btn primary" type="submit" name="mode" value="signin">Se connecter</button><button class="btn" type="submit" name="mode" value="signup">Créer mon compte</button></div></form><button class="text-action" type="button" id="forgot-password">Mot de passe oublié ?</button><p class="small muted" id="auth-message" aria-live="polite">Mot de passe de 8 caractères minimum. La vérification e-mail dépendra des réglages du service.</p></div>';
    return '<div class="card"><span class="tag">COMPTE CONNECTÉ</span><h2 style="margin:14px 0">'+esc(user.email||"Joueur connecté")+'</h2><p class="muted small">Ton compte compagnon est connecté. Synchronise tes données pour les retrouver sur tes autres appareils.</p><div class="action-row"><button class="btn primary" id="sync-now">Synchroniser maintenant</button><button class="btn" id="sign-out">Se déconnecter</button></div><p class="small muted" id="auth-message" aria-live="polite">'+(cloudReady?"Synchronisation active.":"Connecté — première synchronisation à effectuer.")+'</p></div>';
  }
  function merge(local,remote){
    const newer=function(a,b){const ta=Date.parse(a&&a.updatedAt||"")||0,tb=Date.parse(b&&b.updatedAt||"")||0;return ta>=tb?a:b;};
    const quests=new Map();
    (remote.quests||[]).concat(local.quests||[]).forEach(function(q){const k=String(q.name||"").trim().toLowerCase();if(!k)return;const prev=quests.get(k);quests.set(k,prev?Object.assign({},prev,newer(q,prev)):q);});
    const journal=new Map();
    (remote.journal||[]).concat(local.journal||[]).forEach(function(j){journal.set(String(j.date||"")+"|"+String(j.note||""),j);});
    const builds=new Map();
    (remote.builds||[]).concat(local.builds||[]).forEach(function(b){const key=b.id?"id:"+String(b.id):"legacy:"+String(b.name||"")+"|"+String(b.details||"");const prev=builds.get(key);builds.set(key,prev?Object.assign({},prev,newer(b,prev)):b);});
    const checks=Object.assign({},remote.checks||{});
    const checkUpdatedAt=Object.assign({},remote.checkUpdatedAt||{});
    Object.keys(local.checks||{}).forEach(function(k){const lt=Date.parse((local.checkUpdatedAt||{})[k]||"")||0,rt=Date.parse(checkUpdatedAt[k]||"")||0;if(!(k in checks)||lt>=rt){checks[k]=local.checks[k];if((local.checkUpdatedAt||{})[k])checkUpdatedAt[k]=local.checkUpdatedAt[k];}});
    const deleted=new Set((remote.deletedMapNoteIds||[]).concat(local.deletedMapNoteIds||[]).map(String));
    const mapNotes=new Map();
    (remote.mapNotes||[]).concat(local.mapNotes||[]).forEach(function(n){if(n&&n.id&&!deleted.has(String(n.id))){const id=String(n.id),prev=mapNotes.get(id);mapNotes.set(id,prev?newer(n,prev):n);}});
    return Object.assign({},remote,local,{quests:Array.from(quests.values()),journal:Array.from(journal.values()),checks:checks,checkUpdatedAt:checkUpdatedAt,builds:Array.from(builds.values()),mapNotes:Array.from(mapNotes.values()),deletedMapNoteIds:Array.from(deleted),mapRegion:local.mapRegion||remote.mapRegion||"central"});
  }
  async function saveSnapshot(payload,syncUserId){
    let snapshot=payload;
    const api=window.wwmDataApi;
    for(let attempt=0;attempt<4;attempt++){
      if(!user||user.id!==syncUserId)throw new Error("La session a changé. Reconnecte-toi puis relance la synchronisation.");
      const write=await client.rpc("save_companion_state",{
        p_expected_revision:cloudRevision,
        p_schema_version:1,
        p_payload:snapshot
      });
      if(write.error)throw new Error("Erreur d’enregistrement sécurisé : "+write.error.message+". Vérifie que la dernière version de supabase/schema.sql a été appliquée.");
      const result=Array.isArray(write.data)?write.data[0]:write.data;
      if(result&&result.saved){
        cloudRevision=Number(result.revision);
        return snapshot;
      }
      const read=await client.from("companion_state").select("payload,revision").eq("user_id",syncUserId).maybeSingle();
      if(read.error)throw new Error("Erreur de relecture après conflit : "+read.error.message);
      cloudRevision=read.data?Number(read.data.revision):null;
      snapshot=merge(api.getData(),read.data&&read.data.payload||{});
      api.setData(snapshot);
      api.saveLocal();
    }
    throw new Error("Les données ont changé plusieurs fois sur un autre appareil. Relance la synchronisation pour éviter d’écraser une modification.");
  }
  async function sync(){
    if(!client||!user||syncInFlight)return;
    syncInFlight=true;cloudReady=false;cloudRevision=null;
    const syncUserId=user.id;
    try{
      message("Synchronisation en cours…");
      // Finish older autosaves before reading the remote snapshot, otherwise a stale
      // queued write could race with the initial merge and overwrite newer data.
      await queue;
      if(!user||user.id!==syncUserId)throw new Error("La session a changé. Reconnecte-toi puis relance la synchronisation.");
      const api=window.wwmDataApi;const local=api.getData();
      const read=await client.from("companion_state").select("payload,revision").eq("user_id",syncUserId).maybeSingle();
      if(read.error)throw new Error("Erreur de lecture : "+read.error.message);
      cloudRevision=read.data?Number(read.data.revision):null;
      let combined=merge(local,read.data&&read.data.payload||{});
      api.setData(combined);api.saveLocal();
      combined=await saveSnapshot(combined,syncUserId);
      if(!user||user.id!==syncUserId)throw new Error("La session a changé pendant la synchronisation.");
      cloudReady=true;
      const latest=api.getData();
      if(JSON.stringify(latest)!==JSON.stringify(combined))window.wwmCloudSave(latest);
      await queue;
      message("Synchronisation terminée. Tes données sont enregistrées sur ton compte.");
      const state=document.querySelector("#save-state");if(state)state.textContent="● Synchronisation activée";
    }catch(error){
      cloudReady=false;message(error.message||"La synchronisation a échoué.");
      const state=document.querySelector("#save-state");if(state)state.textContent="● Sauvegarde locale — cloud en erreur";
    }finally{syncInFlight=false;}
  }
  window.wwmMergeData=merge;
  window.wwmAccountView=view;
  window.wwmAccountBind=function(root){
    if(!client)return;
    const recoveryForm=root.querySelector("#recovery-form");
    if(recoveryForm)recoveryForm.onsubmit=async function(e){e.preventDefault();const password=recoveryForm.password.value;message("Mise à jour du mot de passe…");const result=await client.auth.updateUser({password:password});if(result.error){message("Erreur : "+result.error.message);return;}recoveryMode=false;message("Mot de passe modifié. Tu peux maintenant utiliser ton nouveau mot de passe.");window.wwmDataApi.render("account");};
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
    const forgot=root.querySelector("#forgot-password");if(forgot)forgot.onclick=async function(){const form=root.querySelector("#auth-form");const email=form.email.value.trim();if(!email){message("Saisis ton adresse e-mail avant de demander un lien de réinitialisation.");return;}const result=await client.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+window.location.pathname});message(result.error?"Erreur : "+result.error.message:"Si un compte correspond à cette adresse, un e-mail de réinitialisation va être envoyé.");};
    const syncButton=root.querySelector("#sync-now");if(syncButton)syncButton.onclick=function(){sync().catch(function(e){message("Erreur de synchronisation : "+e.message);});};
    const out=root.querySelector("#sign-out");if(out)out.onclick=async function(){const result=await client.auth.signOut();if(result.error){message(result.error.message);return;}user=null;cloudReady=false;cloudRevision=null;window.wwmDataApi.render("account");};
  };
  window.wwmCloudSave=function(payload){
    if(!client||!user||!cloudReady)return;
    const saveUserId=user.id;
    queue=queue.then(async function(){
      if(!user||user.id!==saveUserId||!cloudReady)return;
      await saveSnapshot(payload,saveUserId);
    }).catch(function(error){console.error("Cloud sync failed",error);const state=document.querySelector("#save-state");if(state)state.textContent="● Erreur de synchronisation";});
  };
  if(client){
    client.auth.getSession().then(function(result){user=result.data.session&&result.data.session.user||null;const state=document.querySelector("#save-state");if(state&&user)state.textContent="● Compte connecté";});
    client.auth.onAuthStateChange(function(event,session){user=session&&session.user||null;if(event==="PASSWORD_RECOVERY")recoveryMode=true;if(event==="SIGNED_OUT"){recoveryMode=false;cloudReady=false;cloudRevision=null;}else if(event==="SIGNED_IN"||event==="INITIAL_SESSION"){cloudReady=false;cloudRevision=null;}const state=document.querySelector("#save-state");if(state)state.textContent=user?(cloudReady?"● Synchronisation activée":"● Compte connecté"):"● Sauvegarde locale";if(window.wwmDataApi&&window.wwmDataApi.getView()==="account")window.wwmDataApi.render("account");});
  }
})();