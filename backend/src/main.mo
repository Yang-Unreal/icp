import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Iter "mo:core/Iter";

persistent actor {

  type Note = {
    title : Text;
    content : Text;
    tags : [Text];
    pinned : Bool;
    created : Int;
    updated : Int;
  };

  let notes = Map.empty<Nat, Note>();
  var nextId : Nat = 0;

  public func createNote(title : Text, content : Text, tags : [Text], pinned : Bool) : async Nat {
    let id = nextId;
    nextId += 1;
    let now = Time.now();
    Map.add(notes, Nat.compare, id, {
      title;
      content;
      tags;
      pinned;
      created = now;
      updated = now;
    });
    id
  };

  public query func getNote(id : Nat) : async ?Note {
    Map.get(notes, Nat.compare, id)
  };

  public func updateNote(id : Nat, title : Text, content : Text, tags : [Text], pinned : Bool) : async Bool {
    switch (Map.get(notes, Nat.compare, id)) {
      case (?existing) {
        Map.add(notes, Nat.compare, id, {
          title;
          content;
          tags;
          pinned;
          created = existing.created;
          updated = Time.now();
        });
        true
      };
      case null {
        false
      }
    }
  };

  public func deleteNote(id : Nat) : async Bool {
    switch(Map.get(notes, Nat.compare, id)) {
      case (?_) {
        Map.remove(notes, Nat.compare, id);
        true
      };
      case null {
        false
      }
    }
  };

  public query func listNotes() : async [(Nat, Note)] {
    Iter.toArray(Map.entries(notes))
  };
};
