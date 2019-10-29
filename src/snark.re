module Universe = (val Snarky_universe.default());

open! Universe.Impl;
open! Universe;
module PrivateKey = Field;

let merkleTreeDepth = 8;

module Attribute_set = {
  module Commitment = Hash;

  [@deriving yojson]
  type t_('attribute) = array('attribute);
  type t = t_(Commitment.t);

  module Constant = {
    [@deriving yojson]
    type t = t_(Commitment.Constant.t);
  }

  let length = 10;
  let typ = Typ.array(~length, Commitment.typ);
}

module Voter = {
  [@deriving yojson]
  type t_('priv_key, 'attribute_set) = {
    privateKey: 'priv_key,
    attributes: 'attribute_set,
  };

  type t = t_(Field.t, Attribute_set.t);

  module Constant = {
    [@deriving yojson]
    type t = t_(PrivateKey.Constant.t, Attribute_set.Constant.t);
  };

  let typ = {
    open Snarky.H_list;
    let to_hlist = ({privateKey, attributes}) => [privateKey, attributes];
    let of_hlist = ([privateKey, attributes]: t(unit, _)) => {
      privateKey,
      attributes,
    };

    Typ.of_hlistable(
      [PrivateKey.typ, Attribute_set.typ],
      ~var_to_hlist=to_hlist,
      ~var_of_hlist=of_hlist,
      ~value_to_hlist=to_hlist,
      ~value_of_hlist=of_hlist,
    );
  };

  let commit = ({privateKey, attributes} : t) =>
    Hash.hash(Array.append([|privateKey|], attributes));
};

module Witness = {
  type t = (Voter.t, MerkleTree.MembershipProof.t);

  module Constant = {
    [@deriving yojson]
    type t = (Voter.Constant.t, MerkleTree.MembershipProof.Constant.t);
  };

  let typ =
    Typ.tuple2(
      Voter.typ,
      MerkleTree.MembershipProof.typ(~depth=merkleTreeDepth),
    );
};

module Nullifier = {
  include Field;

  let create = (privateKey, electionDescription) =>
    Hash.hash([|privateKey, electionDescription|]);
};

let nullAttr = Field.zero;

let input: InputSpec.t(_) = (
  [ (module Field)
  , (module Nullifier)
  // , (module Vote)
  , (module Field)
  , (module Attribute_set)
  , (module Hash)
  ]: InputSpec.t(_)
);

let main =
    (
      (voter, merkleProof): Witness.t,
      votersRoot,
      nullifier,
      _vote,
      maskedAttributes,
      election,
      (),
    ) => {
  let comm = Voter.commit(voter);
  Bool.assertTrue(MerkleTree.MembershipProof.check(merkleProof, votersRoot, comm));
  for (i in 0 to Attribute_set.length - 1) {
    let claimedAttr = maskedAttributes[i];
    let attr = voter.attributes[i];
    Bool.assertAny([
      Attribute_set.Commitment.equal(claimedAttr, attr),
      Attribute_set.Commitment.equal(claimedAttr, nullAttr),
    ]);
  };
  Nullifier.assertEqual(
    nullifier,
    Nullifier.create(voter.privateKey, election),
  );
};

let () = InputSpec.run_main(input, (module Witness), main);
