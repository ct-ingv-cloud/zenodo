"""
  Copyright 2018 INFN (Italy)

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
"""

__author__ = 'marco'

from datetime import datetime
from flask import Blueprint, current_app, redirect, request
from flask_security import login_user
from flask_security.registerable import register_user
from invenio_accounts.models import User
from random import choice
from string import ascii_lowercase, ascii_uppercase, digits
from sqlalchemy import func
from werkzeug.local import LocalProxy

_security = LocalProxy(lambda: current_app.extensions['security'])
_datastore = LocalProxy(lambda: _security.datastore)


blueprint = Blueprint(
    'zenodo_webauthclient',
    __name__,
    url_prefix='/webauth'
)

@blueprint.route('/login')
def login():
    current_app.logger.info('Try to authenticate a user with mails: %s'
                            %request.environ.get(current_app.config.get('WEBAUTHCLIENT_REMOTE_MAIL')))
    mails = request.environ.get(current_app.config.get('WEBAUTHCLIENT_REMOTE_MAIL', '')).replace(';',',').split(',')

    for mail in mails:
        user = User.query.filter(func.lower(User.email) == func.lower(mail)).one_or_none()
        if user is not None:
            break

    if user is None:
        password = ''.join(choice(ascii_uppercase + ascii_lowercase + digits) for _ in range(16))
        user = register_user(password=password, email=mails[0].lower(), active=True, confirmed_at=datetime.now())

    login_user(user, remember=False)

    return redirect(request.args.get('next'))
