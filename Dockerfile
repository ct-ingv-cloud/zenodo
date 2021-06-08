#
# Zenodo development docker build
#
FROM python:2.7
MAINTAINER Zenodo <info@zenodo.org>

ARG TERM=linux
ARG DEBIAN_FRONTEND=noninteractive

# Install dependencies
RUN apt-get update \
    && apt-get -qy upgrade --fix-missing --no-install-recommends \
    && apt-get -qy install --fix-missing --no-install-recommends \
        apt-utils curl libcairo2-dev fonts-dejavu libfreetype6-dev \
        uwsgi-plugin-python \
    # Node.js
    #&& curl -sL https://deb.nodesource.com/setup_6.x | bash - \
    #&& apt-get -qy install --fix-missing --no-install-recommends \
    #    nodejs \
    # Slim down image
    && apt-get clean autoclean \
    && apt-get autoremove -y \
    && rm -rf /var/lib/{apt,dpkg}/ \
    && rm -rf /usr/share/man/* /usr/share/groff/* /usr/share/info/* \
    && find /usr/share/doc -depth -type f ! -name copyright -delete

# Install NVM
#RUN wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.0/install.sh | bash
#ENV NVM_DIR ~/.nvm
#RUN ["/bin/bash", "-c", ". $HOME/.bashrc && nvm install 7.4.0 && nvm use 7.4.0"]

RUN mkdir /usr/local/nvm
ENV NVM_DIR /usr/local/nvm
ENV NODE_VERSION 7.4.0

# Install nvm with node and npm
#RUN curl https://raw.githubusercontent.com/creationix/nvm/v0.20.0/install.sh | bash \
RUN wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.0/install.sh | bash \
    && . $NVM_DIR/nvm.sh \
    && nvm install $NODE_VERSION \
    && nvm alias default $NODE_VERSION \
    && nvm use default

ENV NODE_PATH $NVM_DIR/versions/node/v$NODE_VERSION/lib/node_modules
ENV PATH      $NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH

# Include /usr/local/bin in path.
RUN echo "export PATH=${PATH}:/usr/local/bin >> ~/.bashrc"

# Basic Python tools
RUN pip install --upgrade pip setuptools ipython wheel uwsgi pipdeptree

# NPM
COPY ./scripts/setup-npm.sh /tmp
RUN ["/bin/bash", "-c", ". $HOME/.bashrc && nvm use 7.4.0 && ./tmp/setup-npm.sh"]

#
# Zenodo specific
#

# Create instance/static folder
ENV INVENIO_INSTANCE_PATH /usr/local/var/instance
RUN mkdir -p ${INVENIO_INSTANCE_PATH}
WORKDIR /tmp

COPY ./invenio.cfg ${INVENIO_INSTANCE_PATH}/

# Copy and install requirements. Faster build utilizing the Docker cache.
COPY requirements*.txt /tmp/
RUN mkdir -p /usr/local/src/ \
    && mkdir -p /code/zenodo \
    && pip install -r requirements.txt --src /usr/local/src

# Copy source code
COPY . /code/zenodo
WORKDIR /code/zenodo

# Install Zenodo
RUN pip install -e .[postgresql,elasticsearch2,all] \
    && python -O -m compileall .

# Install npm dependencies and build assets.
RUN ["/bin/bash", "-c", ". $HOME/.bashrc && nvm use 7.4.0 && zenodo npm --pinned-file /code/zenodo/package.pinned.json \
    && cd ${INVENIO_INSTANCE_PATH}/static \
    && npm install \
    && cd /code/zenodo \
    && zenodo collect -v \
    && zenodo assets build" ]

RUN adduser --uid 1000 --disabled-password --gecos '' zenodo \
    && chown -R zenodo:zenodo /code ${INVENIO_INSTANCE_PATH}

RUN mkdir -p /usr/local/var/data && \
    chown zenodo:zenodo /usr/local/var/data -R && \
    mkdir -p /usr/local/var/run && \
    chown zenodo:zenodo /usr/local/var/run -R && \
    mkdir -p /var/log/zenodo && \
    chown zenodo:zenodo /var/log/zenodo -R

COPY ./docker/docker-entrypoint.sh /

USER zenodo
VOLUME ["/code/zenodo"]
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["zenodo", "run", "-h", "0.0.0.0"]
