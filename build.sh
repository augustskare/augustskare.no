#!/bin/bash
set -e

if [ ! -d "env" ]; then
  virtualenv -p python env
fi

source env/bin/activate
pip install -r requirements.txt

yarn
yarn build:standalone

deactivate