// Copyright 2021 AI Redefined Inc. <dev+cogment@ai-r.com>
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Message } from "google-protobuf";

import { useState, useEffect, useRef } from "react";

//import Canvas from './Canvas'
import { cogSettings } from "./CogSettings";
import * as data_pb from "./data_pb";
import { useActions } from "./hooks/useActions";

import { get_keymap, useControls } from "./hooks/useControls";
import { ControlList } from "./ControlList";

const setContains = <T extends unknown>(A: Set<T>, B: Set<T>): boolean => {
  if (A.size > B.size) {
    return false;
  }

  for (let a of A) {
    if (!B.has(a)) {
      return false;
    }
  }
  return true;
};

const setEquals = <T extends unknown>(A: Set<T>, B: Set<T>): boolean => {
  return setContains(A, B) && setContains(B, A);
};

function App() {
  const [canStartTrial, setCanStartTrial] = useState(true);
  const [pixelData, setPixelData] = useState<string | undefined>();
  const [trialStatus, setTrialStatus] = useState("no trial started");
  const [watching, setWatching] = useState(false);
  const [currentTrialId, setCurrentTrialId] = useState<string | undefined>();

  const [pressedKeys, onKeyDown, onKeyUp] = useControls();
  const [envType, setEnvType] = useState<string>();
  const [envName, setEnvName] = useState<string>();

  const [lastTime, setLastTime] = useState<DOMHighResTimeStamp>(0);
  const [emaFps, setEmaFps] = useState(0.0);
  const [timer, setTimer] = useState<NodeJS.Timeout>();

  const imgRef = useRef<HTMLImageElement>(null);
  const fpsEmaWeight = 1 / 60.0;

  // cogment stuff

  const grpcURL = process.env.REACT_APP_GRPCWEBPROXY_URL;

  type ObservationT = data_pb.Observation.AsObject;
  type ActionT = data_pb.AgentAction;
  type RewardT = Message;
  type ActorConfigT = data_pb.ActorConfig.AsObject;

  useEffect(() => {
    //const canvas = canvasRef.current;
    if (!imgRef) {
      return;
    }
    const img = imgRef.current;
    if (!pixelData || !img) {
      return;
    }
    img.src = "data:image/png;base64," + pixelData;
  });

  const [event, joinTrial, sendAction, reset, trialJoined, watchTrials, trialStateList, actorConfig] = useActions<
    ObservationT,
    ActionT,
    RewardT,
    ActorConfigT
  >(
    // TODO remove that once the issue is fixed in the js SDK
    // @ts-ignore
    cogSettings,
    "web_actor", // actor name
    "teacher_agent", // actor class
    grpcURL
  );

  //let lastTime: number | undefined = undefined;

  useEffect(() => {
    if (trialJoined && actorConfig && event.observation && event.observation.pixelData) {
      setPixelData(event.observation.pixelData as string);

      //lastTime = currentTime;
    }
  }, [event, actorConfig, trialJoined]);

  useEffect(() => {
    if (trialJoined && actorConfig && event.observation && event.observation.pixelData) {
      if (!event.last) {
        // todo: this should be read from actor conig
        const action = new data_pb.AgentAction();
        let action_int = -1;
        const keymap = get_keymap(actorConfig.envType, actorConfig.envName);

        if (keymap === undefined) {
          console.log(`no keymap defined for environment ${actorConfig.envName}`);
        } else {
          for (let item of keymap.action_map) {
            const keySet = new Set<string>(item.keys);
            if (setEquals(keySet, pressedKeys)) {
              action_int = item.id;
            }
          }
        }

        action.setDiscreteAction(action_int);

        const minDelta = 1000.0 / 30.0; // 30 fps
        const currentTime = new Date().getTime();
        const timeout = lastTime ? Math.max(0, minDelta - (currentTime - lastTime) - 1) : 0;

        if (!timer) {
          setTimer(
            setTimeout(() => {
              const currentTime = new Date().getTime();
              const fps = 1000.0 / Math.max(1, currentTime - lastTime);
              setEmaFps(fpsEmaWeight * fps + (1 - fpsEmaWeight) * emaFps);

              if (sendAction) {
                sendAction(action);
              }
              setTimer(undefined);
              setLastTime(currentTime);
            }, timeout)
          );
        }
      }
    }
    return () => {
      if (timer) {
        clearTimeout(timer);
        setTimer(undefined);
      }
    };
  }, [event, sendAction, trialJoined, actorConfig, pressedKeys, lastTime, timer, emaFps, fpsEmaWeight]);

  useEffect(() => {
    if (trialJoined) {
      setTrialStatus("trial joined");
      setCanStartTrial(false);
      if (actorConfig) {
        setEnvName(actorConfig.envName);
        setEnvType(actorConfig.envType);
      }
    } else {
      setTrialStatus("no trial running");
      setCurrentTrialId(undefined);
      setCanStartTrial(true);
    }
  }, [trialJoined, trialStatus, actorConfig]);

  useEffect(() => {
    if (watchTrials && !watching) {
      watchTrials();
      setWatching(true);
    }
  }, [watchTrials, watching]);

  //This will start a trial as soon as we're connected to the orchestrator
  const triggerJoinTrial = () => {
    if (!joinTrial || trialJoined) {
      return;
    }
    reset();

    if (trialStateList === undefined) {
      return;
    }

    let trialIdToJoin: string | undefined = undefined;

    // find a trial to join
    for (let trialId of Array.from(trialStateList.keys())) {
      let state = trialStateList.get(trialId);

      // trial is pending
      if (state === 2) {
        trialIdToJoin = trialId;
        break;
      }
    }

    if (trialIdToJoin === undefined) {
      console.log("no trial to join");
      return;
    } else {
      console.log(`attempting to join trial ${trialIdToJoin}`);
    }

    if (canStartTrial) {
      //startTrial(trialConfig);
      joinTrial(trialIdToJoin);
      console.log("calling joinTrial");
      setCurrentTrialId(trialIdToJoin);
      if (trialJoined) {
        setCanStartTrial(false);
        setCurrentTrialId(trialIdToJoin);
        console.log("trial joined");
      } else {
        setTrialStatus("could not start trial");
      }
    }
  };

  useEffect(() => {
    const timer = setInterval(triggerJoinTrial, 200);
    return () => {
      clearInterval(timer);
    };
  });

  return (
    <div onKeyDown={onKeyDown} onKeyUp={onKeyUp} tabIndex={0}>
      <h1>Cogverse Web Client</h1>
      {pixelData && <img ref={imgRef} width="50%" alt="current trial observation" />}
      <br></br>
      <button onClick={triggerJoinTrial}>Join Trial</button>
      <br></br>
      Status: {trialStatus}
      <br></br>
      Trial ID: {currentTrialId}
      <br></br>
      <ControlList envType={envType} envName={envName} />
      <br></br>
      FPS: {`${emaFps.toFixed(1)}`}
    </div>
  );
}

export default App;