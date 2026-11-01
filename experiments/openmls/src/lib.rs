//! Synthetic-device feasibility harness only. No app import, server or custom crypto.
use openmls::prelude::tls_codec::{Deserialize as TlsDeserialize, Serialize as TlsSerialize};
use openmls::prelude::*;
use openmls_basic_credential::SignatureKeyPair;
use openmls_rust_crypto::OpenMlsRustCrypto;
use openmls_traits::OpenMlsProvider;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

const SUITE: Ciphersuite = Ciphersuite::MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519;
fn failure(_: impl std::fmt::Debug) -> JsValue {
    JsValue::from_str("OpenMLS operation rejected")
}
#[derive(Serialize, Deserialize)]
struct SavedState {
    version: u8,
    identity: String,
    signer: SignatureKeyPair,
    group_id: Option<Vec<u8>>,
    storage: Vec<(Vec<u8>, Vec<u8>)>,
}
#[wasm_bindgen]
pub struct Device {
    identity: String,
    signer: SignatureKeyPair,
    provider: OpenMlsRustCrypto,
    group: Option<MlsGroup>,
}
#[wasm_bindgen]
impl Device {
    #[wasm_bindgen(constructor)]
    pub fn new(identity: String) -> Result<Device, JsValue> {
        if identity.is_empty() || identity.len() > 80 {
            return Err(failure("identity"));
        }
        let provider = OpenMlsRustCrypto::default();
        let signer = SignatureKeyPair::new(SUITE.signature_algorithm()).map_err(failure)?;
        signer.store(provider.storage()).map_err(failure)?;
        Ok(Self {
            identity,
            signer,
            provider,
            group: None,
        })
    }
    fn credential(&self) -> CredentialWithKey {
        CredentialWithKey {
            credential: BasicCredential::new(self.identity.as_bytes().to_vec()).into(),
            signature_key: self.signer.to_public_vec().into(),
        }
    }
    pub fn key_package(&self) -> Result<Vec<u8>, JsValue> {
        KeyPackage::builder()
            .build(SUITE, &self.provider, &self.signer, self.credential())
            .map_err(failure)?
            .key_package()
            .tls_serialize_detached()
            .map_err(failure)
    }
    pub fn create_group(&mut self) -> Result<(), JsValue> {
        if self.group.is_some() {
            return Err(failure("already joined"));
        }
        let config = MlsGroupCreateConfig::builder()
            .ciphersuite(SUITE)
            .use_ratchet_tree_extension(true)
            .max_past_epochs(0)
            .build();
        self.group = Some(
            MlsGroup::new(&self.provider, &self.signer, &config, self.credential())
                .map_err(failure)?,
        );
        Ok(())
    }
    /// Returns JSON with public MLS commit and welcome byte arrays, never secrets.
    pub fn add(&mut self, package: &[u8]) -> Result<String, JsValue> {
        let key_package = KeyPackageIn::tls_deserialize_exact(package)
            .map_err(failure)?
            .validate(self.provider.crypto(), ProtocolVersion::Mls10)
            .map_err(failure)?;
        let group = self.group.as_mut().ok_or_else(|| failure("no group"))?;
        let (commit, welcome, _) = group
            .add_members(&self.provider, &self.signer, &[key_package])
            .map_err(failure)?;
        let result = serde_json::json!({ "commit": commit.tls_serialize_detached().map_err(failure)?, "welcome": welcome.tls_serialize_detached().map_err(failure)? });
        group
            .merge_pending_commit(&self.provider)
            .map_err(failure)?;
        Ok(result.to_string())
    }
    pub fn join(&mut self, welcome: &[u8]) -> Result<(), JsValue> {
        if self.group.is_some() {
            return Err(failure("already joined"));
        }
        let MlsMessageBodyIn::Welcome(welcome) = MlsMessageIn::tls_deserialize_exact(welcome)
            .map_err(failure)?
            .extract()
        else {
            return Err(failure("not welcome"));
        };
        self.group = Some(
            StagedWelcome::new_from_welcome(
                &self.provider,
                &MlsGroupJoinConfig::builder().max_past_epochs(0).build(),
                welcome,
                None,
            )
            .map_err(failure)?
            .into_group(&self.provider)
            .map_err(failure)?,
        );
        Ok(())
    }
    pub fn send(&mut self, text: &str) -> Result<Vec<u8>, JsValue> {
        if text.len() > 2000 {
            return Err(failure("message too large"));
        }
        self.group
            .as_mut()
            .ok_or_else(|| failure("no group"))?
            .create_message(&self.provider, &self.signer, text.as_bytes())
            .map_err(failure)?
            .tls_serialize_detached()
            .map_err(failure)
    }
    pub fn receive(&mut self, message: &[u8]) -> Result<String, JsValue> {
        let message = MlsMessageIn::tls_deserialize_exact(message)
            .map_err(failure)?
            .try_into_protocol_message()
            .map_err(failure)?;
        let group = self.group.as_mut().ok_or_else(|| failure("no group"))?;
        let processed = group
            .process_message(&self.provider, message)
            .map_err(failure)?;
        match processed.into_content() {
            ProcessedMessageContent::ApplicationMessage(value) => {
                String::from_utf8(value.into_bytes()).map_err(failure)
            }
            ProcessedMessageContent::StagedCommitMessage(commit) => {
                group
                    .merge_staged_commit(&self.provider, *commit)
                    .map_err(failure)?;
                Ok("[commit]".into())
            }
            _ => Err(failure("unexpected message")),
        }
    }
    pub fn remove(&mut self, identity: &str) -> Result<Vec<u8>, JsValue> {
        let group = self.group.as_mut().ok_or_else(|| failure("no group"))?;
        let index = group
            .members()
            .find(|m| m.credential.serialized_content() == identity.as_bytes())
            .ok_or_else(|| failure("unknown member"))?
            .index;
        let (commit, _, _) = group
            .remove_members(&self.provider, &self.signer, &[index])
            .map_err(failure)?;
        let wire = commit.tls_serialize_detached().map_err(failure)?;
        group
            .merge_pending_commit(&self.provider)
            .map_err(failure)?;
        Ok(wire)
    }
    /// SECRET plaintext fixture snapshot, for testing reload only. Never send to relay/log.
    pub fn snapshot(&self) -> Result<String, JsValue> {
        let state = SavedState {
            version: 1,
            identity: self.identity.clone(),
            signer: self.signer.clone(),
            group_id: self
                .group
                .as_ref()
                .map(|g| g.group_id().as_slice().to_vec()),
            storage: self
                .provider
                .storage()
                .values
                .read()
                .map_err(failure)?
                .iter()
                .map(|(k, v)| (k.clone(), v.clone()))
                .collect(),
        };
        serde_json::to_string(&state).map_err(failure)
    }
    pub fn restore(snapshot: &str) -> Result<Device, JsValue> {
        if snapshot.len() > 10_000_000 {
            return Err(failure("snapshot too large"));
        }
        let state: SavedState = serde_json::from_str(snapshot).map_err(failure)?;
        if state.version != 1 {
            return Err(failure("snapshot version"));
        }
        let provider = OpenMlsRustCrypto::default();
        *provider.storage().values.write().map_err(failure)? = state.storage.into_iter().collect();
        let group = match state.group_id {
            Some(id) => Some(
                MlsGroup::load(provider.storage(), &GroupId::from_slice(&id))
                    .map_err(failure)?
                    .ok_or_else(|| failure("missing group"))?,
            ),
            None => None,
        };
        Ok(Self {
            identity: state.identity,
            signer: state.signer,
            provider,
            group,
        })
    }
}
