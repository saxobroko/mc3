(function() {
  registerModsInit(function() {
    function logicWireUpdate(pos, recursive = false) {
      var block = getBlock(pos);
      var props = getItemProps(block);
      
      var connections = [0, 0, 0, 0];
      for(var face = 2; face < 6; face++) {
        var nearbyPos = vectorAdd(pos, faces[face]);
        var nearbyProps = getItemProps(getBlock(nearbyPos));
        if(nearbyProps.groups.includes("logic_wire")) {
          connections[face - 2] = 1;
          if(recursive) {
            logicWireUpdate(nearbyPos, false);
          }
        } else if("logic_source" in nearbyProps) {
          if(nearbyProps.logic_source) {
            connections[face - 2] = 1;
          }
        } else if("logic_sink" in nearbyProps) {
          if(nearbyProps.logic_sink) {
            connections[face - 2] = 1;
          }
        }
      }
      
      if(!props.groups.includes("logic_wire")) {
        return;
      }
      
      var newItemName = "logic:wire_" + connections[0].toString() + connections[1].toString() + connections[2].toString() + connections[3].toString();
      if(!("logic_wireState" in props)) {
        return;
      }
      if(props.logic_wireState) {
        newItemName += "_on";
      } else {
        newItemName += "_off";
      }
      
      if(props.name != newItemName) {
        //intelligentSetBlock(pos, getItemID(newItemName)); //FIXME more efficient refresh
        setBlock(pos, getItemID(newItemName));
      }
    }
    
    function logicWireTraverseOff(pos) {
      var block = getBlock(pos);
      var props = getItemProps(block);
      
      if(props.groups.includes("logic_wire")) {
        if("logic_wireState" in props) {
          if(props.logic_wireState) {
            setBlock(pos, getItemID(props.name.substring(0, props.name.length - 3) + "_off"));
            //console.log("off!");
          }
        }
      }
      
      for(var face = 2; face < 6; face++) {
        var nearbyPos = vectorAdd(pos, faces[face]);
        var nearbyProps = getItemProps(getBlock(nearbyPos));
        if(nearbyProps.groups.includes("logic_wire")) {
          if(!("logic_wireState" in nearbyProps)) {
            continue;
          }
          if(nearbyProps.logic_wireState) {
            logicWireTraverseOff(nearbyPos);
          }
        }
      }
    }
    
    var traverseLog = [];
    var sinks = [];
    function logicWireTraverseOn(pos, targetState = false) {
      var block = getBlock(pos);
      var props = getItemProps(block);
      
      if(props.groups.includes("logic_wire") && ("logic_wireState" in props)) {
        if(!props.logic_wireState && targetState) {
          setBlock(pos, getItemID(props.name.substring(0, props.name.length - 4) + "_on"));
          //console.log("on!");
        }
      }
      
      for(var face = 2; face < 6; face++) {
        var nearbyPos = vectorAdd(pos, faces[face]);
        var nearbyProps = getItemProps(getBlock(nearbyPos));
        if(nearbyProps.groups.includes("logic_wire")) {
          if("logic_wireState" in nearbyProps) {
            //console.log("cascade adjacent current=" + nearbyProps.logic_wireState + " target=" + targetState);
            if(!nearbyProps.logic_wireState) {
              if(!targetState) {
                var skip = false;
                for(var i = 0; i < traverseLog.length; i++) {
                  if(nearbyPos.equals(traverseLog[i])) {
                    skip = true;
                    break;
                  }
                }
                if(skip) { continue; }
                traverseLog.push(nearbyPos);
              }
              logicWireTraverseOn(nearbyPos, targetState);
            }
          }
        } else if("logic_source" in nearbyProps) {
          if(nearbyProps.logic_source && !targetState) {
            targetState = true;
            //traverseLog = [];
            traverseLog.push(pos);
            logicWireTraverseOn(pos, true);
            return;
          }
        } else if("logic_sink" in nearbyProps) {
          if(nearbyProps.logic_sink) {
            var found = false;
            for(var i = 0; i < sinks.length; i++) {
              if(nearbyPos.equals(sinks[i].pos)) {
                sinks[i].state = targetState;
                found = true;
                break;
              }
            }
            if(!found) {
              sinks.push({pos: nearbyPos, state: targetState});
            }
          }
        }
      }
    }
    
    function logicWirePostPlace(pos, itemToPlace) {
      logicWireUpdate(pos, true);
      //console.log(getItemName(getBlock(pos)));
      logicWireTraverseOff(pos);
      traverseLog = [];
      sinks = [];
      traverseLog.push(pos);
      logicWireTraverseOn(pos);
      
      for(var i = 0; i < sinks.length; i++) {
        var state = false;
        for(var face = 2; face < 6; face++) {
          var nearbyPos = vectorAdd(sinks[i].pos, faces[face]);
          var nearbyProps = getItemProps(getBlock(nearbyPos));
          if(nearbyProps.groups.includes("logic_wire")) {
            if("logic_wireState" in nearbyProps) {
              if(nearbyProps.logic_wireState) {
                state = true;
                break;
              }
            }
          }
        }
        
        var block = getBlock(sinks[i].pos);
        var props = getItemProps(block);
        if("logic_sink_update" in props) {
          props.logic_sink_update(sinks[i].pos, state);
        }
      }
      
      var chunksTouched = [];
      for(var i = 0; i < traverseLog.length; i++) {
        var chunkIn = vectorDivide(traverseLog[i], CHUNK_SIZE);
        var skip = false;
        for(var n = 0; n < chunksTouched.length; n++) {
          if(chunkIn.equals(chunksTouched[n])) {
            skip = true;
            break;
          }
        }
        if(skip) { continue; }
        chunksTouched.push(chunkIn);
        intelligentReloadChunkMeshNear(traverseLog[i]);
      }
    }
    function logicWireDestroy(pos) {
      //logicWireUpdate(pos, true);
      logicWirePostPlace(pos, null);
    }
    function logicWireChange(pos) {
      //logicWireUpdate(pos, true);
      logicWirePostPlace(pos, null);
    }
    
    if(getItemProps("ores:redstone_dust") != null) {
      setItemProp("ores:redstone_dust", "placeable", true);
      setItemProp("ores:redstone_dust", "onPlace", function(pos, itemToPlace) {
        intelligentSetBlock(pos, getItemID("logic:wire_0000_off"));
        useHUDActiveItem();
        getItemProps("logic:wire_0000_off").postPlace(pos, getItemID("logic:wire_0000_off"));
        return false;
      });
    } else {
      registerItem({
        name: "ores:redstone_dust",
        displayName: "Redstone Dust",
        //textureOffsetAlt: {all: new THREE.Vector2(256, 240)},
        transparent: true,
        icon: "textures/items/redstone_dust.png",
        //groups: ["logic_wire"],
        hardness: 0,
        onPlace: function(pos, itemToPlace) {
          intelligentSetBlock(pos, getItemID("logic:wire_0000_off"));
          useHUDActiveItem();
          getItemProps("logic:wire_0000_off").postPlace(pos, getItemID("logic:wire_0000_off"));
          return false;
        }
      });
    }
    
    var dropItem = "ores:redstone_dust"; //"logic:wire"
    
    for(var i = 0; i < 16; i++) {
      var tex = new THREE.Vector2(256 + (i * 16), 112);
      var ts = textureMapIndexScale;
      registerItem({
        name: "logic:wire_" + ((i >> 3) & 1).toString() + ((i >> 2) & 1).toString() + ((i >> 1) & 1).toString() + (i & 1).toString() + "_off",
        inInventory: false,
        drops: new InvItem(dropItem, 1),
        textureOffsetAlt: {all: tex},
        customMesh: true,
        meshVertices: [
          -0.5, -0.489, -0.5,
           0.5, -0.489, -0.5,
           -0.5, -0.489, 0.5,
           
           0.5, -0.489, -0.5,
           0.5, -0.489, 0.5,
           -0.5, -0.489, 0.5
        ],
        meshUVs: [
          0.0 + (tex.x*ts), uvSize + (tex.y*ts),
          uvSize + (tex.x*ts), uvSize + (tex.y*ts),
          0.0 + (tex.x*ts), 0.0 + (tex.y*ts),

          uvSize + (tex.x*ts), uvSize + (tex.y*ts),
          uvSize + (tex.x*ts), 0.0 + (tex.y*ts),
          0.0 + (tex.x*ts), 0.0 + (tex.y*ts)
        ],
        meshFaces: [
          {dir: new THREE.Vector3(0, 1, 0), length: 6}
        ],
        transparent: true,
        walkable: true,
        groups: ["logic_wire"],
        hardness: 0,
        logic_wireConnects: i,
        logic_wireState: false,
        postPlace: logicWirePostPlace,
        onDestroy: logicWireDestroy
      });
    }
    
    for(var i = 0; i < 16; i++) {
      var tex = new THREE.Vector2(256 + (i * 16), 96);
      var ts = textureMapIndexScale;
      registerItem({
        name: "logic:wire_" + ((i >> 3) & 1).toString() + ((i >> 2) & 1).toString() + ((i >> 1) & 1).toString() + (i & 1).toString() + "_on",
        inInventory: false,
        drops: new InvItem(dropItem, 1),
        textureOffsetAlt: {all: tex},
        customMesh: true,
        meshVertices: [
          -0.5, -0.489, -0.5,
           0.5, -0.489, -0.5,
           -0.5, -0.489, 0.5,
           
           0.5, -0.489, -0.5,
           0.5, -0.489, 0.5,
           -0.5, -0.489, 0.5
        ],
        meshUVs: [
          0.0 + (tex.x*ts), uvSize + (tex.y*ts),
          uvSize + (tex.x*ts), uvSize + (tex.y*ts),
          0.0 + (tex.x*ts), 0.0 + (tex.y*ts),

          uvSize + (tex.x*ts), uvSize + (tex.y*ts),
          uvSize + (tex.x*ts), 0.0 + (tex.y*ts),
          0.0 + (tex.x*ts), 0.0 + (tex.y*ts)
        ],
        meshFaces: [
          {dir: new THREE.Vector3(0, 1, 0), length: 6}
        ],
        transparent: true,
        walkable: true,
        groups: ["logic_wire"],
        hardness: 0,
        lightLevel: 5,
        logic_wireConnects: i,
        logic_wireState: true,
        postPlace: logicWirePostPlace,
        onDestroy: logicWireDestroy
      });
    }
    
    if(getItemProps("ores:redstone_block") != null) {
      setItemProp("ores:redstone_block", "logic_source", true);
      setItemProp("ores:redstone_block", "postPlace", logicWirePostPlace);
      setItemProp("ores:redstone_block", "onDestroy", logicWireDestroy);
    }
    
    //Sinks
    function lampUpdate(pos, state) {
      var block = getBlock(pos);
      if(block == getItemID("logic:lamp_off") && state == true) {
        setBlock(pos, getItemID("logic:lamp_on"));
      }
      if(block == getItemID("logic:lamp_on") && state == false) {
        setBlock(pos, getItemID("logic:lamp_off"));
      }
    }
    registerItem({
      name: "logic:lamp_off",
      displayName: "Redstone Lamp",
      icon: "textures/icons/redstone_lamp.png",
      textureOffsetAlt: {all: new THREE.Vector2(256, 80)},
      hardness: 0.3,
      logic_sink: true,
      logic_sink_update: lampUpdate,
      postPlace: logicWirePostPlace,
      onDestroy: logicWireDestroy
    });
    registerItem({
      name: "logic:lamp_on",
      displayName: "Redstone Lamp",
      drops: new InvItem("logic:lamp_off", 1),
      inInventory: false,
      textureOffsetAlt: {all: new THREE.Vector2(272, 80)},
      hardness: 0.3,
      lightLevel: 10,
      logic_sink: true,
      logic_sink_update: lampUpdate,
      postPlace: logicWirePostPlace,
      onDestroy: logicWireDestroy
    });
    
    function pistonUpdate(pos, state) {
      setTimeout(function() { pistonUpdate2(pos, state); }, 1 / 20);
    }
    function pistonUpdate2(pos, state) {
      var block = getBlock(pos);
      
      var meta = getBlockMeta(pos);
      var facing = 0;
      if("facing" in meta) {
        facing = mod(meta.facing, 4);
      }
      var face = 2;
      
      if(face >= 2) {
        face -= 2;
        if(face == 0) { face = 3; } else if(face == 3) { face = 0; }
        face = (face + (facing)) % 4;
        if(facing == 0) { face = 3; } else if(face == 3) { face = 0; }
        face += 2;
      }
      
      var f = [4, 3, 5, 2];
      
      var targetPos = vectorAdd(pos, faces[mod(f[facing], 6)]);
      var targetBlock = getBlock(targetPos);
      var targetPos2 = vectorAdd(targetPos, faces[mod(f[facing], 6)]);
      var targetBlock2 = getBlock(targetPos2);
      
      if(block == getItemID("logic:piston_off") && state == true) {
        if(targetBlock2 == getItemID("default:air")) { //targetBlock != getItemID("default:air") && 
          setBlock(pos, getItemID("logic:piston_on"));
          
          setBlock(targetPos, getItemID("logic:piston_on_2"));
          setBlock(targetPos2, targetBlock);
          var targetMeta = getBlockMeta(targetPos);
          if(Object.keys(targetMeta).length > 0) {
            setBlockMeta(targetPos2, targetMeta);
            clearBlockMeta(targetPos);
          }
          setBlockMeta(targetPos, {facing: facing});
          
          intelligentReloadChunkMeshNear(pos);
          logicWireChange(targetPos2);
        }
      }
      if(block == getItemID("logic:piston_on") && state == false) {
        setBlock(pos, getItemID("logic:piston_off"));
        if(targetBlock == getItemID("logic:piston_on_2")) {
          clearBlockMeta(targetPos);
          setBlock(targetPos, getItemID("default:air"));
        }
        
        intelligentReloadChunkMeshNear(pos);
      }
    }
    var texLR = new THREE.Vector2(304, 80);
    var texTB = new THREE.Vector2(320, 80);
    var texB = new THREE.Vector2(336, 80);
    var texF = new THREE.Vector2(288, 80);
    var ts = textureMapIndexScale;
    registerItem({
      name: "logic:piston_off",
      displayName: "Piston",
      icon: "textures/icons/piston.png",
      textureOffsetAlt: {front: new THREE.Vector2(288, 80), left: new THREE.Vector2(304, 80), right: new THREE.Vector2(304, 80), top: new THREE.Vector2(320, 80), bottom: new THREE.Vector2(320, 80), back: new THREE.Vector2(336, 80)},
      customMesh: true,
      meshVertices: [
        -0.5, 0.5, -0.5, //top
        0.5, 0.5, -0.5,
        -0.5, 0.5, 0.5,

        0.5, 0.5, -0.5,
        0.5, 0.5, 0.5,
        -0.5, 0.5, 0.5,

        -0.5, -0.5, -0.5, //bottom
        0.5, -0.5, -0.5,
        -0.5, -0.5, 0.5,

        0.5, -0.5, -0.5,
        0.5, -0.5, 0.5,
        -0.5, -0.5, 0.5,

        -0.5, 0.5, -0.5, //left
        -0.5, 0.5, 0.5,
        -0.5, -0.5, -0.5,

        -0.5, 0.5, 0.5,
        -0.5, -0.5, 0.5,
        -0.5, -0.5, -0.5,

        0.5, 0.5, -0.5, //right
        0.5, 0.5, 0.5,
        0.5, -0.5, -0.5,

        0.5, 0.5, 0.5,
        0.5, -0.5, 0.5,
        0.5, -0.5, -0.5,

        -0.5, 0.5, 0.5, //front
        0.5, 0.5, 0.5,
        -0.5, -0.5, 0.5,

        0.5, 0.5, 0.5,
        0.5, -0.5, 0.5,
        -0.5, -0.5, 0.5,

        -0.5, 0.5, -0.5, //back
        0.5, 0.5, -0.5,
        -0.5, -0.5, -0.5,

        0.5, 0.5, -0.5,
        0.5, -0.5, -0.5,
        -0.5, -0.5, -0.5
      ],
      meshUVs: [
        0.0 + (texTB.x*ts), uvSize + (texTB.y*ts), //top
        uvSize + (texTB.x*ts), uvSize + (texTB.y*ts),
        0.0 + (texTB.x*ts), 0.0 + (texTB.y*ts),

        uvSize + (texTB.x*ts), uvSize + (texTB.y*ts),
        uvSize + (texTB.x*ts), 0.0 + (texTB.y*ts),
        0.0 + (texTB.x*ts), 0.0 + (texTB.y*ts),
        
        0.0 + (texTB.x*ts), uvSize + (texTB.y*ts), //bottom
        uvSize + (texTB.x*ts), uvSize + (texTB.y*ts),
        0.0 + (texTB.x*ts), 0.0 + (texTB.y*ts),

        uvSize + (texTB.x*ts), uvSize + (texTB.y*ts),
        uvSize + (texTB.x*ts), 0.0 + (texTB.y*ts),
        0.0 + (texTB.x*ts), 0.0 + (texTB.y*ts),
        
        0.0 + (texLR.x*ts), uvSize + (texLR.y*ts), //left
        uvSize + (texLR.x*ts), uvSize + (texLR.y*ts),
        0.0 + (texLR.x*ts), 0.0 + (texLR.y*ts),

        uvSize + (texLR.x*ts), uvSize + (texLR.y*ts),
        uvSize + (texLR.x*ts), 0.0 + (texLR.y*ts),
        0.0 + (texLR.x*ts), 0.0 + (texLR.y*ts),
        
        0.0 + (texLR.x*ts), uvSize + (texLR.y*ts), //right
        uvSize + (texLR.x*ts), uvSize + (texLR.y*ts),
        0.0 + (texLR.x*ts), 0.0 + (texLR.y*ts),

        uvSize + (texLR.x*ts), uvSize + (texLR.y*ts),
        uvSize + (texLR.x*ts), 0.0 + (texLR.y*ts),
        0.0 + (texLR.x*ts), 0.0 + (texLR.y*ts),
        
        0.0 + (texF.x*ts), uvSize + (texF.y*ts), //front
        uvSize + (texF.x*ts), uvSize + (texF.y*ts),
        0.0 + (texF.x*ts), 0.0 + (texF.y*ts),

        uvSize + (texF.x*ts), uvSize + (texF.y*ts),
        uvSize + (texF.x*ts), 0.0 + (texF.y*ts),
        0.0 + (texF.x*ts), 0.0 + (texF.y*ts),
        
        0.0 + (texB.x*ts), uvSize + (texB.y*ts), //back
        uvSize + (texB.x*ts), uvSize + (texB.y*ts),
        0.0 + (texB.x*ts), 0.0 + (texB.y*ts),

        uvSize + (texB.x*ts), uvSize + (texB.y*ts),
        uvSize + (texB.x*ts), 0.0 + (texB.y*ts),
        0.0 + (texB.x*ts), 0.0 + (texB.y*ts)
      ],
      meshFaces: [
        {dir: new THREE.Vector3(0, 1, 0), length: 6},
        {dir: new THREE.Vector3(0, -1, 0), length: 6},
        {dir: new THREE.Vector3(-1, 0, 0), length: 6},
        {dir: new THREE.Vector3(1, 0, 0), length: 6},
        {dir: new THREE.Vector3(0, 0, 1), length: 6},
        {dir: new THREE.Vector3(0, 0, -1), length: 6}
      ],
      hardness: 0.5,
      logic_sink: true,
      logic_sink_update: pistonUpdate,
      postPlace: logicWirePostPlace,
      onDestroy: logicWireDestroy,
      directional: true
    });
    var texLR = new THREE.Vector2(304, 80);
    var texTB = new THREE.Vector2(320, 80);
    var texB = new THREE.Vector2(336, 80);
    var texF = new THREE.Vector2(352, 80);
    var ts = textureMapIndexScale;
    registerItem({
      name: "logic:piston_on",
      displayName: "Piston",
      drops: new InvItem("logic:piston_off", 1),
      inInventory: false,
      textureOffsetAlt: {all: new THREE.Vector2(272, 80)},
      customMesh: true,
      meshVertices: [
        -0.5, 0.5, -0.5, //top
        0.5, 0.5, -0.5,
        -0.5, 0.5, 0.25,

        0.5, 0.5, -0.5,
        0.5, 0.5, 0.25,
        -0.5, 0.5, 0.25,

        -0.5, -0.5, -0.5, //bottom
        0.5, -0.5, -0.5,
        -0.5, -0.5, 0.25,

        0.5, -0.5, -0.5,
        0.5, -0.5, 0.25,
        -0.5, -0.5, 0.25,

        -0.5, 0.5, -0.5, //left
        -0.5, 0.5, 0.25,
        -0.5, -0.5, -0.5,

        -0.5, 0.5, 0.25,
        -0.5, -0.5, 0.25,
        -0.5, -0.5, -0.5,

        0.5, 0.5, -0.5, //right
        0.5, 0.5, 0.25,
        0.5, -0.5, -0.5,

        0.5, 0.5, 0.25,
        0.5, -0.5, 0.25,
        0.5, -0.5, -0.5,

        -0.5, 0.5, 0.25, //front
        0.5, 0.5, 0.25,
        -0.5, -0.5, 0.25,

        0.5, 0.5, 0.25,
        0.5, -0.5, 0.25,
        -0.5, -0.5, 0.25,

        -0.5, 0.5, -0.5, //back
        0.5, 0.5, -0.5,
        -0.5, -0.5, -0.5,

        0.5, 0.5, -0.5,
        0.5, -0.5, -0.5,
        -0.5, -0.5, -0.5
      ],
      meshUVs: [
        0.0 + (texTB.x*ts), uvSize + (texTB.y*ts), //top
        uvSize + (texTB.x*ts), uvSize + (texTB.y*ts),
        0.0 + (texTB.x*ts), (uvSize/4) + (texTB.y*ts),

        uvSize + (texTB.x*ts), uvSize + (texTB.y*ts),
        uvSize + (texTB.x*ts), (uvSize/4) + (texTB.y*ts),
        0.0 + (texTB.x*ts), (uvSize/4) + (texTB.y*ts),
        
        0.0 + (texTB.x*ts), uvSize + (texTB.y*ts), //bottom
        uvSize + (texTB.x*ts), uvSize + (texTB.y*ts),
        0.0 + (texTB.x*ts), (uvSize/4) + (texTB.y*ts),

        uvSize + (texTB.x*ts), uvSize + (texTB.y*ts),
        uvSize + (texTB.x*ts), (uvSize/4) + (texTB.y*ts),
        0.0 + (texTB.x*ts), (uvSize/4) + (texTB.y*ts),
        
        0.0 + (texLR.x*ts), uvSize + (texLR.y*ts), //left
        (uvSize*0.75) + (texLR.x*ts), uvSize + (texLR.y*ts),
        0.0 + (texLR.x*ts), 0.0 + (texLR.y*ts),

        (uvSize*0.75) + (texLR.x*ts), uvSize + (texLR.y*ts),
        (uvSize*0.75) + (texLR.x*ts), 0.0 + (texLR.y*ts),
        0.0 + (texLR.x*ts), 0.0 + (texLR.y*ts),
        
        0.0 + (texLR.x*ts), uvSize + (texLR.y*ts), //right
        (uvSize*0.75) + (texLR.x*ts), uvSize + (texLR.y*ts),
        0.0 + (texLR.x*ts), 0.0 + (texLR.y*ts),

        (uvSize*0.75) + (texLR.x*ts), uvSize + (texLR.y*ts),
        (uvSize*0.75) + (texLR.x*ts), 0.0 + (texLR.y*ts),
        0.0 + (texLR.x*ts), 0.0 + (texLR.y*ts),
        
        0.0 + (texF.x*ts), uvSize + (texF.y*ts), //front
        uvSize + (texF.x*ts), uvSize + (texF.y*ts),
        0.0 + (texF.x*ts), 0.0 + (texF.y*ts),

        uvSize + (texF.x*ts), uvSize + (texF.y*ts),
        uvSize + (texF.x*ts), 0.0 + (texF.y*ts),
        0.0 + (texF.x*ts), 0.0 + (texF.y*ts),
        
        0.0 + (texB.x*ts), uvSize + (texB.y*ts), //back
        uvSize + (texB.x*ts), uvSize + (texB.y*ts),
        0.0 + (texB.x*ts), 0.0 + (texB.y*ts),

        uvSize + (texB.x*ts), uvSize + (texB.y*ts),
        uvSize + (texB.x*ts), 0.0 + (texB.y*ts),
        0.0 + (texB.x*ts), 0.0 + (texB.y*ts)
      ],
      meshFaces: [
        {dir: new THREE.Vector3(0, 1, 0), length: 6},
        {dir: new THREE.Vector3(0, -1, 0), length: 6},
        {dir: new THREE.Vector3(-1, 0, 0), length: 6},
        {dir: new THREE.Vector3(1, 0, 0), length: 6},
        {dir: new THREE.Vector3(0, 0, 1), length: 6},
        {dir: new THREE.Vector3(0, 0, -1), length: 6}
      ],
      transparent: true,
      hardness: 0.5,
      logic_sink: true,
      logic_sink_update: pistonUpdate,
      postPlace: logicWirePostPlace,
      onDestroy: logicWireDestroy,
      directional: true
    });
    var texLR = new THREE.Vector2(304, 80);
    var texTB = new THREE.Vector2(320, 80);
    var texB = new THREE.Vector2(288, 80);
    var texF = new THREE.Vector2(288, 80);
    var ts = textureMapIndexScale;
    registerItem({
      name: "logic:piston_on_2",
      drops: new InvItem("logic:piston_off", 1),
      inInventory: false,
      textureOffsetAlt: {all: new THREE.Vector2(272, 80)},
      customMesh: true,
      meshVertices: [
        -0.5, 0.5, 0.25, //top
        0.5, 0.5, 0.25,
        -0.5, 0.5, 0.5,

        0.5, 0.5, 0.25,
        0.5, 0.5, 0.5,
        -0.5, 0.5, 0.5,

        -0.5, -0.5, 0.25, //bottom
        0.5, -0.5, 0.25,
        -0.5, -0.5, 0.5,

        0.5, -0.5, 0.25,
        0.5, -0.5, 0.5,
        -0.5, -0.5, 0.5,

        -0.5, 0.5, 0.25, //left
        -0.5, 0.5, 0.5,
        -0.5, -0.5, 0.25,

        -0.5, 0.5, 0.5,
        -0.5, -0.5, 0.5,
        -0.5, -0.5, 0.25,

        0.5, 0.5, 0.25, //right
        0.5, 0.5, 0.5,
        0.5, -0.5, 0.25,

        0.5, 0.5, 0.5,
        0.5, -0.5, 0.5,
        0.5, -0.5, 0.25,

        -0.5, 0.5, 0.5, //front
        0.5, 0.5, 0.5,
        -0.5, -0.5, 0.5,

        0.5, 0.5, 0.5,
        0.5, -0.5, 0.5,
        -0.5, -0.5, 0.5,

        -0.5, 0.5, 0.25, //back
        0.5, 0.5, 0.25,
        -0.5, -0.5, 0.25,

        0.5, 0.5, 0.25,
        0.5, -0.5, 0.25,
        -0.5, -0.5, 0.25
      ],
      meshUVs: [
        0.0 + (texTB.x*ts), (uvSize*0.25) + (texTB.y*ts), //top
        uvSize + (texTB.x*ts), (uvSize*0.25) + (texTB.y*ts),
        0.0 + (texTB.x*ts), 0.0 + (texTB.y*ts),

        uvSize + (texTB.x*ts), (uvSize*0.25) + (texTB.y*ts),
        uvSize + (texTB.x*ts), 0.0 + (texTB.y*ts),
        0.0 + (texTB.x*ts), 0.0 + (texTB.y*ts),
        
        0.0 + (texTB.x*ts), uvSize + (texTB.y*ts), //bottom
        uvSize + (texTB.x*ts), uvSize + (texTB.y*ts),
        0.0 + (texTB.x*ts), (uvSize/4) + (texTB.y*ts),

        uvSize + (texTB.x*ts), uvSize + (texTB.y*ts),
        uvSize + (texTB.x*ts), (uvSize/4) + (texTB.y*ts),
        0.0 + (texTB.x*ts), (uvSize/4) + (texTB.y*ts),
        
        (uvSize*0.75) + (texLR.x*ts), uvSize + (texLR.y*ts), //left
        uvSize + (texLR.x*ts), uvSize + (texLR.y*ts),
        (uvSize*0.75) + (texLR.x*ts), 0.0 + (texLR.y*ts),

        uvSize + (texLR.x*ts), uvSize + (texLR.y*ts),
        uvSize + (texLR.x*ts), 0.0 + (texLR.y*ts),
        (uvSize*0.75) + (texLR.x*ts), 0.0 + (texLR.y*ts),
        
        (uvSize*0.75) + (texLR.x*ts), uvSize + (texLR.y*ts), //right
        uvSize + (texLR.x*ts), uvSize + (texLR.y*ts),
        (uvSize*0.75) + (texLR.x*ts), 0.0 + (texLR.y*ts),

        uvSize + (texLR.x*ts), uvSize + (texLR.y*ts),
        uvSize + (texLR.x*ts), 0.0 + (texLR.y*ts),
        (uvSize*0.75) + (texLR.x*ts), 0.0 + (texLR.y*ts),
        
        0.0 + (texF.x*ts), uvSize + (texF.y*ts), //front
        uvSize + (texF.x*ts), uvSize + (texF.y*ts),
        0.0 + (texF.x*ts), 0.0 + (texF.y*ts),

        uvSize + (texF.x*ts), uvSize + (texF.y*ts),
        uvSize + (texF.x*ts), 0.0 + (texF.y*ts),
        0.0 + (texF.x*ts), 0.0 + (texF.y*ts),
        
        0.0 + (texB.x*ts), uvSize + (texB.y*ts), //back
        uvSize + (texB.x*ts), uvSize + (texB.y*ts),
        0.0 + (texB.x*ts), 0.0 + (texB.y*ts),

        uvSize + (texB.x*ts), uvSize + (texB.y*ts),
        uvSize + (texB.x*ts), 0.0 + (texB.y*ts),
        0.0 + (texB.x*ts), 0.0 + (texB.y*ts)
      ],
      meshFaces: [
        {dir: new THREE.Vector3(0, 1, 0), length: 6},
        {dir: new THREE.Vector3(0, -1, 0), length: 6},
        {dir: new THREE.Vector3(-1, 0, 0), length: 6},
        {dir: new THREE.Vector3(1, 0, 0), length: 6},
        {dir: new THREE.Vector3(0, 0, 1), length: 6},
        {dir: new THREE.Vector3(0, 0, -1), length: 6}
      ],
      transparent: true,
      hardness: 0.5,
      logic_sink: true,
      logic_sink_update: pistonUpdate,
      postPlace: logicWirePostPlace,
      onDestroy: logicWireDestroy,
      directional: true
    });
  });
})();
